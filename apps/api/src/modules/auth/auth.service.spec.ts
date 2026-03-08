import {
  AuthService,
  DEV_TOKEN_SECRET,
  PRODUCTION_SECRET_ERROR,
  resolveTokenSecret,
} from './auth.service';

describe('AuthService production secret guardrail', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAuthTokenSecret = process.env.AUTH_TOKEN_SECRET;

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalAuthTokenSecret === undefined) {
      delete process.env.AUTH_TOKEN_SECRET;
    } else {
      process.env.AUTH_TOKEN_SECRET = originalAuthTokenSecret;
    }
  });

  it('falls back to the dev secret outside production', () => {
    delete process.env.NODE_ENV;
    delete process.env.AUTH_TOKEN_SECRET;

    expect(resolveTokenSecret()).toBe(DEV_TOKEN_SECRET);
  });

  it('fails fast in production when AUTH_TOKEN_SECRET is unset', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.AUTH_TOKEN_SECRET;

    expect(() => new AuthService()).toThrow(PRODUCTION_SECRET_ERROR);
  });

  it('fails fast in production when AUTH_TOKEN_SECRET is blank', () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_TOKEN_SECRET = '   ';

    expect(() => new AuthService()).toThrow(PRODUCTION_SECRET_ERROR);
  });

  it('fails fast in production when AUTH_TOKEN_SECRET uses the dev fallback value', () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_TOKEN_SECRET = DEV_TOKEN_SECRET;

    expect(() => new AuthService()).toThrow(PRODUCTION_SECRET_ERROR);
  });

  it('boots with an explicit production secret and signs verifiable tokens', () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_TOKEN_SECRET = 'planovna-prod-secret-for-tests';

    const service = new AuthService();
    const loginResult = service.login({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });

    expect(loginResult).not.toBeNull();
    expect(loginResult?.tokenType).toBe('Bearer');
    expect(service.verify(loginResult!.accessToken)).toMatchObject({
      tenantId: 'tenant-a',
      userId: 'u-tenant-a-owner',
      role: 'OWNER',
    });
  });
});
