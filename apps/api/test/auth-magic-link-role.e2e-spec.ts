import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Auth magic-link + role guard (e2e)', () => {
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

  it('creates one-time magic link token and invalidates after consume', async () => {
    const appServer = app.getHttpServer();

    const requestToken = await request(appServer)
      .post('/auth/magic-link/request')
      .send({ email: 'finance@tenant-a.local' });

    expect(requestToken.status).toBe(201);
    expect(typeof requestToken.body.token).toBe('string');

    const consumeOnce = await request(appServer)
      .post('/auth/magic-link/consume')
      .send({ token: requestToken.body.token as string });

    expect(consumeOnce.status).toBe(201);
    expect(consumeOnce.body.tokenType).toBe('Bearer');
    expect(typeof consumeOnce.body.accessToken).toBe('string');

    const consumeAgain = await request(appServer)
      .post('/auth/magic-link/consume')
      .send({ token: requestToken.body.token as string });

    expect(consumeAgain.status).toBe(401);
  });

  it('enforces OWNER|FINANCE on invoice write endpoints and keeps tenant isolation via token context', async () => {
    const appServer = app.getHttpServer();

    const plannerLogin = await request(appServer).post('/auth/login').send({
      email: 'planner@tenant-a.local',
      password: 'tenant-a-pass',
    });
    expect(plannerLogin.status).toBe(201);

    const shopfloorLogin = await request(appServer).post('/auth/login').send({
      email: 'shopfloor@tenant-a.local',
      password: 'tenant-a-pass',
    });
    expect(shopfloorLogin.status).toBe(201);

    const financeLogin = await request(appServer).post('/auth/login').send({
      email: 'finance@tenant-a.local',
      password: 'tenant-a-pass',
    });
    expect(financeLogin.status).toBe(201);

    const ownerBLogin = await request(appServer).post('/auth/login').send({
      email: 'owner@tenant-b.local',
      password: 'tenant-b-pass',
    });
    expect(ownerBLogin.status).toBe(201);

    const plannerIssue = await request(appServer)
      .post('/invoices/issue')
      .set('authorization', `Bearer ${plannerLogin.body.accessToken as string}`)
      .send({
        tenantId: 'tenant-a',
        orderId: 'order-2',
        number: '2026-0200',
        currency: 'CZK',
        amountGross: 2500,
        dueAt: new Date('2026-04-05').toISOString(),
      });
    expect(plannerIssue.status).toBe(403);

    const financeIssue = await request(appServer)
      .post('/invoices/issue')
      .set('authorization', `Bearer ${financeLogin.body.accessToken as string}`)
      .send({
        tenantId: 'tenant-b',
        orderId: 'order-2',
        number: '2026-0201',
        currency: 'CZK',
        amountGross: 2500,
        dueAt: new Date('2026-04-05').toISOString(),
      });

    expect(financeIssue.status).toBe(201);
    expect(financeIssue.body.tenantId).toBe('tenant-a');

    const shopfloorPaid = await request(appServer)
      .post('/invoices/paid')
      .set('authorization', `Bearer ${shopfloorLogin.body.accessToken as string}`)
      .send({
        invoiceId: financeIssue.body.id,
        paidAt: new Date('2026-04-06').toISOString(),
        version: financeIssue.body.version,
        tenantId: 'tenant-a',
      });

    expect(shopfloorPaid.status).toBe(403);

    const crossTenantPaid = await request(appServer)
      .post('/invoices/paid')
      .set('authorization', `Bearer ${ownerBLogin.body.accessToken as string}`)
      .send({
        invoiceId: financeIssue.body.id,
        paidAt: new Date('2026-04-06').toISOString(),
        version: financeIssue.body.version,
        tenantId: 'tenant-a',
      });

    expect(crossTenantPaid.status).toBe(403);

    const financePaid = await request(appServer)
      .post('/invoices/paid')
      .set('authorization', `Bearer ${financeLogin.body.accessToken as string}`)
      .send({
        invoiceId: financeIssue.body.id,
        paidAt: new Date('2026-04-06').toISOString(),
        version: financeIssue.body.version,
        tenantId: 'tenant-b',
      });

    expect(financePaid.status).toBe(201);
    expect(financePaid.body.status).toBe('PAID');
  });
});
