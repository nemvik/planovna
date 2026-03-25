import { Injectable, OnModuleInit } from '@nestjs/common';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  LoginDto,
  LoginResponseDto,
  RegisterDto,
  MagicLinkConsumeDto,
  MagicLinkRequestDto,
} from './dto/auth.dto';

export type AuthRole = 'OWNER' | 'PLANNER' | 'SHOPFLOOR' | 'FINANCE';

export type AuthTokenPayload = {
  tenantId: string;
  userId: string;
  role: AuthRole;
  exp: number;
};

type UserRecord = {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string | null;
  role: AuthRole;
};

type MagicLinkRequestResponse = {
  token: string;
  expiresAt: string;
};

type RegisterAttemptWindow = {
  startedAtMs: number;
  count: number;
};

type SeedTenant = {
  id: string;
  name: string;
  users: Array<{
    id: string;
    email: string;
    password: string;
    role: AuthRole;
  }>;
};

const DEV_TOKEN_SECRET = 'planovna-dev-secret';
const PRODUCTION_SECRET_ERROR =
  'AUTH_TOKEN_SECRET must be set to a non-default value in production';
const TEST_AUTH_SEED: SeedTenant[] = [
  {
    id: 'tenant-a',
    name: 'Tenant A',
    users: [
      {
        id: 'u-tenant-a-owner',
        email: 'owner@tenant-a.local',
        password: 'tenant-a-pass',
        role: 'OWNER',
      },
      {
        id: 'u-tenant-a-finance',
        email: 'finance@tenant-a.local',
        password: 'tenant-a-pass',
        role: 'FINANCE',
      },
      {
        id: 'u-tenant-a-planner',
        email: 'planner@tenant-a.local',
        password: 'tenant-a-pass',
        role: 'PLANNER',
      },
      {
        id: 'u-tenant-a-shopfloor',
        email: 'shopfloor@tenant-a.local',
        password: 'tenant-a-pass',
        role: 'SHOPFLOOR',
      },
    ],
  },
  {
    id: 'tenant-b',
    name: 'Tenant B',
    users: [
      {
        id: 'u-tenant-b-owner',
        email: 'owner@tenant-b.local',
        password: 'tenant-b-pass',
        role: 'OWNER',
      },
    ],
  },
];

function resolveTokenSecret(env = process.env): string {
  const configuredSecret = env.AUTH_TOKEN_SECRET?.trim();
  const isProduction = env.NODE_ENV === 'production';

  if (
    isProduction &&
    (!configuredSecret || configuredSecret === DEV_TOKEN_SECRET)
  ) {
    throw new Error(PRODUCTION_SECRET_ERROR);
  }

  return configuredSecret || DEV_TOKEN_SECRET;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly tokenSecret = resolveTokenSecret();
  private readonly tokenTtlSeconds = 60 * 60;
  private readonly magicLinkTtlSeconds = 15 * 60;
  private readonly registerAttempts = new Map<string, RegisterAttemptWindow>();
  private readonly registerRateLimitWindowMs = 60_000;
  private readonly registerRateLimitMaxAttempts = 5;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    if (process.env.NODE_ENV !== 'test') {
      return;
    }

    await this.ensureTestAuthSeed();
  }

  isRegisterRateLimited(email: string, clientIp?: string): boolean {
    const key = this.registerAttemptKey(email, clientIp);
    const nowMs = Date.now();
    const window = this.registerAttempts.get(key);

    if (!window || nowMs - window.startedAtMs >= this.registerRateLimitWindowMs) {
      this.registerAttempts.set(key, { startedAtMs: nowMs, count: 1 });
      return false;
    }

    if (window.count >= this.registerRateLimitMaxAttempts) {
      return true;
    }

    window.count += 1;
    return false;
  }

  async register(input: RegisterDto): Promise<LoginResponseDto | null> {
    const email = input.email.trim().toLowerCase();
    if (await this.findUserByEmail(email)) {
      return null;
    }

    const tenantId = `tenant-${randomUUID()}`;
    const ownerId = `u-${tenantId}-owner`;
    const passwordHash = this.hashPassword(input.password);

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.tenant.create({
        data: {
          id: tenantId,
          name: input.companyName,
        },
      });

      return await tx.user.create({
        data: {
          id: ownerId,
          tenantId,
          email,
          passwordHash,
          role: 'OWNER',
        },
        select: {
          id: true,
          tenantId: true,
          email: true,
          passwordHash: true,
          role: true,
        },
      });
    });

    return this.issueAccessToken(user);
  }

  async login(input: LoginDto): Promise<LoginResponseDto | null> {
    const user = await this.findUserByEmail(input.email);
    if (!user?.passwordHash) return null;

    const passwordHash = this.hashPassword(input.password);
    if (passwordHash !== user.passwordHash) return null;

    return this.issueAccessToken(user);
  }

  async requestMagicLink(
    input: MagicLinkRequestDto,
  ): Promise<MagicLinkRequestResponse | null> {
    const user = await this.findUserByEmail(input.email);
    if (!user) return null;

    const expiresAt = this.nowInSeconds() + this.magicLinkTtlSeconds;
    const token = `${randomUUID()}.${expiresAt}`;

    await this.prisma.user.update({
      where: {
        tenantId_email: {
          tenantId: user.tenantId,
          email: user.email,
        },
      },
      data: {
        magicLinkToken: this.hashMagicToken(token),
      },
    });

    return {
      token,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
    };
  }

  async consumeMagicLink(
    input: MagicLinkConsumeDto,
  ): Promise<LoginResponseDto | null> {
    const expiresAt = this.extractMagicLinkExpiry(input.token);
    if (!expiresAt || expiresAt <= this.nowInSeconds()) {
      return null;
    }

    const tokenHash = this.hashMagicToken(input.token);
    const user = await this.prisma.user.findFirst({
      where: { magicLinkToken: tokenHash },
      select: {
        id: true,
        tenantId: true,
        email: true,
        passwordHash: true,
        role: true,
      },
    });

    if (!user) {
      return null;
    }

    await this.prisma.user.update({
      where: {
        tenantId_email: {
          tenantId: user.tenantId,
          email: user.email,
        },
      },
      data: {
        magicLinkToken: null,
      },
    });

    return this.issueAccessToken(user);
  }

  verify(accessToken: string): AuthTokenPayload | null {
    const [encodedPayload, encodedSignature] = accessToken.split('.');
    if (!encodedPayload || !encodedSignature) return null;

    const expectedSignature = createHmac('sha256', this.tokenSecret)
      .update(encodedPayload)
      .digest('base64url');

    const signatureBuffer = Buffer.from(encodedSignature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return null;
    }

    try {
      const payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as AuthTokenPayload;
      if (
        !payload.tenantId ||
        !payload.userId ||
        !payload.role ||
        typeof payload.exp !== 'number'
      ) {
        return null;
      }
      if (payload.exp <= this.nowInSeconds()) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  private async ensureTestAuthSeed() {
    for (const tenant of TEST_AUTH_SEED) {
      await this.prisma.tenant.upsert({
        where: { id: tenant.id },
        update: { name: tenant.name },
        create: {
          id: tenant.id,
          name: tenant.name,
        },
      });

      for (const user of tenant.users) {
        await this.prisma.user.upsert({
          where: {
            tenantId_email: {
              tenantId: tenant.id,
              email: user.email,
            },
          },
          update: {
            passwordHash: this.hashPassword(user.password),
            role: user.role,
          },
          create: {
            id: user.id,
            tenantId: tenant.id,
            email: user.email,
            passwordHash: this.hashPassword(user.password),
            role: user.role,
          },
        });
      }
    }
  }

  private issueAccessToken(user: UserRecord): LoginResponseDto {
    const exp = this.nowInSeconds() + this.tokenTtlSeconds;
    const payload: AuthTokenPayload = {
      tenantId: user.tenantId,
      userId: user.id,
      role: user.role,
      exp,
    };

    return {
      tokenType: 'Bearer',
      accessToken: this.sign(payload),
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  private async findUserByEmail(email: string): Promise<UserRecord | null> {
    const normalizedEmail = email.trim().toLowerCase();

    return await this.prisma.user.findFirst({
      where: {
        email: normalizedEmail,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        tenantId: true,
        email: true,
        passwordHash: true,
        role: true,
      },
    });
  }

  private registerAttemptKey(email: string, clientIp?: string): string {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedIp = clientIp?.trim() || 'unknown-ip';
    return `${normalizedIp}:${normalizedEmail}`;
  }

  private hashMagicToken(token: string): string {
    return createHmac('sha256', this.tokenSecret).update(token).digest('hex');
  }

  private extractMagicLinkExpiry(token: string): number | null {
    const [, expiresAtRaw] = token.split('.');
    if (!expiresAtRaw) {
      return null;
    }

    const expiresAt = Number(expiresAtRaw);
    if (!Number.isFinite(expiresAt)) {
      return null;
    }

    return expiresAt;
  }

  private nowInSeconds(): number {
    return Math.floor(Date.now() / 1000);
  }

  private sign(payload: AuthTokenPayload): string {
    const encodedPayload = Buffer.from(
      JSON.stringify(payload),
      'utf8',
    ).toString('base64url');
    const encodedSignature = createHmac('sha256', this.tokenSecret)
      .update(encodedPayload)
      .digest('base64url');
    return `${encodedPayload}.${encodedSignature}`;
  }

  private hashPassword(rawPassword: string): string {
    return createHash('sha256').update(rawPassword).digest('hex');
  }
}

export { DEV_TOKEN_SECRET, PRODUCTION_SECRET_ERROR, resolveTokenSecret };
