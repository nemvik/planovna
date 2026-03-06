import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Legacy REST auth lockdown (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 404 on removed auth REST endpoints', async () => {
    const appServer = app.getHttpServer();

    await request(appServer)
      .post('/auth/login')
      .send({ email: 'owner@tenant-a.local', password: 'tenant-a-pass' })
      .expect(404);

    await request(appServer)
      .post('/auth/magic-link/request')
      .send({ email: 'owner@tenant-a.local' })
      .expect(404);

    await request(appServer)
      .post('/auth/magic-link/consume')
      .send({ token: 'any-token' })
      .expect(404);
  });
});
