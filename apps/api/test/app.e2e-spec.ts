import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApiApp } from './../src/bootstrap';
import { AppModule } from './../src/app.module';
import { AppService, type ReadinessResponse } from './../src/app.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const originalCorsAllowedOrigins = process.env.API_CORS_ALLOWED_ORIGINS;

  afterEach(async () => {
    await app?.close();

    if (originalCorsAllowedOrigins === undefined) {
      delete process.env.API_CORS_ALLOWED_ORIGINS;
    } else {
      process.env.API_CORS_ALLOWED_ORIGINS = originalCorsAllowedOrigins;
    }
  });

  async function createApp(readiness: ReadinessResponse) {
    const appServiceMock = {
      getHealth: () => ({
        status: 'ready',
        service: 'api',
      }),
      getReadiness: async () => readiness,
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AppService)
      .useValue(appServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApiApp(app);
    await app.init();
  }

  it('/health (GET)', async () => {
    await createApp({
      status: 'ready',
      service: 'api',
      dependencies: {
        database: {
          status: 'up',
        },
      },
    });

    await request(app.getHttpServer()).get('/health').expect(200).expect({
      status: 'ready',
      service: 'api',
    });
  });

  it('/health/ready (GET) returns 200 when database is reachable', async () => {
    await createApp({
      status: 'ready',
      service: 'api',
      dependencies: {
        database: {
          status: 'up',
        },
      },
    });

    await request(app.getHttpServer()).get('/health/ready').expect(200).expect({
      status: 'ready',
      service: 'api',
      dependencies: {
        database: {
          status: 'up',
        },
      },
    });
  });

  it('/health/ready (GET) returns 503 when database is unavailable', async () => {
    await createApp({
      status: 'not_ready',
      service: 'api',
      dependencies: {
        database: {
          status: 'down',
          code: 'DATABASE_UNAVAILABLE',
          reason: 'database unreachable',
        },
      },
    });

    await request(app.getHttpServer()).get('/health/ready').expect(503).expect({
      status: 'not_ready',
      service: 'api',
      dependencies: {
        database: {
          status: 'down',
          code: 'DATABASE_UNAVAILABLE',
          reason: 'database unreachable',
        },
      },
    });
  });

  it('allows configured CORS origins for preflight requests', async () => {
    process.env.API_CORS_ALLOWED_ORIGINS = 'https://allowed.planovna.test';

    await createApp({
      status: 'ready',
      service: 'api',
      dependencies: {
        database: {
          status: 'up',
        },
      },
    });

    const response = await request(app.getHttpServer())
      .options('/health')
      .set('Origin', 'https://allowed.planovna.test')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe(
      'https://allowed.planovna.test',
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not add CORS headers for disallowed origins', async () => {
    process.env.API_CORS_ALLOWED_ORIGINS = 'https://allowed.planovna.test';

    await createApp({
      status: 'ready',
      service: 'api',
      dependencies: {
        database: {
          status: 'up',
        },
      },
    });

    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'https://blocked.planovna.test')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('allows configured CORS origins for tRPC preflight requests', async () => {
    process.env.API_CORS_ALLOWED_ORIGINS = 'https://allowed.planovna.test';

    await createApp({
      status: 'ready',
      service: 'api',
      dependencies: {
        database: {
          status: 'up',
        },
      },
    });

    const response = await request(app.getHttpServer())
      .options('/trpc/auth.login')
      .set('Origin', 'https://allowed.planovna.test')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe(
      'https://allowed.planovna.test',
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not add CORS headers for disallowed origins on tRPC requests', async () => {
    process.env.API_CORS_ALLOWED_ORIGINS = 'https://allowed.planovna.test';

    await createApp({
      status: 'ready',
      service: 'api',
      dependencies: {
        database: {
          status: 'up',
        },
      },
    });

    const response = await request(app.getHttpServer())
      .post('/trpc/auth.login')
      .set('Origin', 'https://blocked.planovna.test')
      .send({
        email: 'owner@tenant-a.local',
        password: 'tenant-a-pass',
      })
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });
});
