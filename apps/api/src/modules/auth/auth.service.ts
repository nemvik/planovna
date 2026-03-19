import { Injectable } from '@nestjs/common';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
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

type User = {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  role: AuthRole;
};

type Tenant = {
  id: string;
  name: string;
};

type MagicLinkToken = {
  tokenHash: string;
  userId: string;
  expiresAt: number;
};

type MagicLinkRequestResponse = {
  token: string;
  expiresAt: string;
};

type RegisterAttemptWindow = {
  startedAtMs: number;
  count: number;
};

const DEV_TOKEN_SECRET = 'planovna-dev-secret';
const PRODUCTION_SECRET_ERROR =
  'AUTH_TOKEN_SECRET must be set to a non-default value in production';

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
export class AuthService {
  private readonly tokenSecret = resolveTokenSecret();
  private readonly tokenTtlSeconds = 60 * 60;
  private readonly magicLinkTtlSeconds = 15 * 60;
  private readonly tenants: Tenant[] = [
    { id: 'tenant-a', name: 'Tenant A' },
    { id: 'tenant-b', name: 'Tenant B' },
  ];
  private readonly users: User[] = [
    {
      id: 'u-tenant-a-owner',
      tenantId: 'tenant-a',
      email: 'owner@tenant-a.local',
      passwordHash: this.hashPassword('tenant-a-pass'),
      role: 'OWNER',
    },
    {
      id: 'u-tenant-a-finance',
      tenantId: 'tenant-a',
      email: 'finance@tenant-a.local',
      passwordHash: this.hashPassword('tenant-a-pass'),
      role: 'FINANCE',
    },
    {
      id: 'u-tenant-a-planner',
      tenantId: 'tenant-a',
      email: 'planner@tenant-a.local',
      passwordHash: this.hashPassword('tenant-a-pass'),
      role: 'PLANNER',
    },
    {
      id: 'u-tenant-a-shopfloor',
      tenantId: 'tenant-a',
      email: 'shopfloor@tenant-a.local',
      passwordHash: this.hashPassword('tenant-a-pass'),
      role: 'SHOPFLOOR',
    },
    {
      id: 'u-tenant-b-owner',
      tenantId: 'tenant-b',
      email: 'owner@tenant-b.local',
      passwordHash: this.hashPassword('tenant-b-pass'),
      role: 'OWNER',
    },
  ];
  private readonly magicLinkTokens = new Map<string, MagicLinkToken>();
  private readonly registerAttempts = new Map<string, RegisterAttemptWindow>();
  private readonly registerRateLimitWindowMs = 60_000;
  private readonly registerRateLimitMaxAttempts = 5;

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

  register(input: RegisterDto): LoginResponseDto | null {
    const email = input.email.trim().toLowerCase();
    if (this.findUserByEmail(email)) {
      return null;
    }

    const tenantId = `tenant-${randomUUID()}`;
    const ownerId = `u-${tenantId}-owner`;

    this.tenants.push({
      id: tenantId,
      name: input.companyName,
    });

    const user: User = {
      id: ownerId,
      tenantId,
      email,
      passwordHash: this.hashPassword(input.password),
      role: 'OWNER',
    };
    this.users.push(user);

    return this.issueAccessToken(user);
  }

  login(input: LoginDto): LoginResponseDto | null {
    const user = this.findUserByEmail(input.email);
    if (!user) return null;

    const passwordHash = this.hashPassword(input.password);
    if (passwordHash !== user.passwordHash) return null;

    return this.issueAccessToken(user);
  }

  requestMagicLink(input: MagicLinkRequestDto): MagicLinkRequestResponse | null {
    const user = this.findUserByEmail(input.email);
    if (!user) return null;

    const token = randomUUID();
    const expiresAt = this.nowInSeconds() + this.magicLinkTtlSeconds;
    this.magicLinkTokens.set(token, {
      tokenHash: this.hashMagicToken(token),
      userId: user.id,
      expiresAt,
    });

    return {
      token,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
    };
  }

  consumeMagicLink(input: MagicLinkConsumeDto): LoginResponseDto | null {
    const storedToken = this.magicLinkTokens.get(input.token);
    if (!storedToken) {
      return null;
    }

    if (storedToken.expiresAt <= this.nowInSeconds()) {
      this.magicLinkTokens.delete(input.token);
      return null;
    }

    if (storedToken.tokenHash !== this.hashMagicToken(input.token)) {
      return null;
    }

    const user = this.findUserById(storedToken.userId);
    if (!user) return null;

    this.magicLinkTokens.delete(input.token);

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

  private issueAccessToken(user: User): LoginResponseDto {
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

  private findUserByEmail(email: string): User | undefined {
    return this.users.find(
      (candidate) => candidate.email.toLowerCase() === email.toLowerCase(),
    );
  }

  private findUserById(userId: string): User | undefined {
    return this.users.find((candidate) => candidate.id === userId);
  }

  private registerAttemptKey(email: string, clientIp?: string): string {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedIp = clientIp?.trim() || 'unknown-ip';
    return `${normalizedIp}:${normalizedEmail}`;
  }

  private hashMagicToken(token: string): string {
    return createHmac('sha256', this.tokenSecret).update(token).digest('hex');
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
