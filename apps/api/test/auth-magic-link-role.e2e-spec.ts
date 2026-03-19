import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { randomUUID } from 'node:crypto';

describe('Legacy REST auth + onboarding (e2e)', () => {
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

  it('registers a tenant-owner and rejects duplicate email', async () => {
    const appServer = app.getHttpServer();
    const payload = {
      email: `founder-${randomUUID().slice(0, 8)}@example.test`,
      password: 'welcome',
      companyName: `Foundry ${randomUUID().slice(0, 8)}`,
    };

    const created = await request(appServer)
      .post('/auth/register')
      .send(payload)
      .expect(201);

    expect(created.body.tokenType).toBe('Bearer');
    expect(created.body.accessToken).toBeTruthy();
    expect(created.body.expiresAt).toBeTruthy();

    await request(appServer)
      .post('/auth/register')
      .send(payload)
      .expect(409);
  });

  it('rate limits repeated registration attempts from same email/ip identity window', async () => {
    const appServer = app.getHttpServer();
    const email = `rate-limit-${randomUUID().slice(0, 8)}@example.test`;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(appServer)
        .post('/auth/register')
        .send({
          email,
          password: `welcome-${attempt}`,
          companyName: `Foundry ${randomUUID().slice(0, 8)}`,
        })
        .expect(attempt === 0 ? 201 : 409);
    }

    await request(appServer)
      .post('/auth/register')
      .send({
        email,
        password: 'welcome-final',
        companyName: `Foundry ${randomUUID().slice(0, 8)}`,
      })
      .expect(429);
  });

  it('allows registration attempts again after rate-limit cooldown window elapses', async () => {
    const appServer = app.getHttpServer();
    const email = `rate-limit-reset-${randomUUID().slice(0, 8)}@example.test`;
    const fixedNow = new Date('2026-03-19T08:04:00.000Z').getTime();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(appServer)
        .post('/auth/register')
        .send({
          email,
          password: `welcome-${attempt}`,
          companyName: `Foundry ${randomUUID().slice(0, 8)}`,
        })
        .expect(attempt === 0 ? 201 : 409);
    }

    await request(appServer)
      .post('/auth/register')
      .send({
        email,
        password: 'welcome-limited',
        companyName: `Foundry ${randomUUID().slice(0, 8)}`,
      })
      .expect(429);

    nowSpy.mockReturnValue(fixedNow + 61_000);

    await request(appServer)
      .post('/auth/register')
      .send({
        email,
        password: 'welcome-after-cooldown',
        companyName: `Foundry ${randomUUID().slice(0, 8)}`,
      })
      .expect(409);
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
