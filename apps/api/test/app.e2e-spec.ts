import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AppService, type ReadinessResponse } from './../src/app.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  afterEach(async () => {
    await app?.close();
  });

  async function createApp(readiness: ReadinessResponse) {
    const appServiceMock = {
      getHealth: jest.fn().mockReturnValue({
        status: 'ready',
        service: 'api',
      }),
      getReadiness: jest.fn().mockResolvedValue(readiness),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AppService)
      .useValue(appServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
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
});
