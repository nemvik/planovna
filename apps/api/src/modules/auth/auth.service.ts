import { Injectable } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { LoginDto, LoginResponseDto } from './dto/auth.dto';

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

@Injectable()
export class AuthService {
  private readonly tokenSecret =
    process.env.AUTH_TOKEN_SECRET ?? 'planovna-dev-secret';
  private readonly tokenTtlSeconds = 60 * 60;
  private readonly users: User[] = [
    {
      id: 'u-tenant-a-owner',
      tenantId: 'tenant-a',
      email: 'owner@tenant-a.local',
      passwordHash: this.hashPassword('tenant-a-pass'),
      role: 'OWNER',
    },
    {
      id: 'u-tenant-b-owner',
      tenantId: 'tenant-b',
      email: 'owner@tenant-b.local',
      passwordHash: this.hashPassword('tenant-b-pass'),
      role: 'OWNER',
    },
  ];

  login(input: LoginDto): LoginResponseDto | null {
    const user = this.users.find(
      (candidate) =>
        candidate.email.toLowerCase() === input.email.toLowerCase(),
    );
    if (!user) return null;

    const passwordHash = this.hashPassword(input.password);
    if (passwordHash !== user.passwordHash) return null;

    const exp = Math.floor(Date.now() / 1000) + this.tokenTtlSeconds;
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
      if (payload.exp <= Math.floor(Date.now() / 1000)) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
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
