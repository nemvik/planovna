import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Auth + invoice paid (e2e)', () => {
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

  it('allows same-tenant invoice markPaid while denying cross-tenant token', async () => {
    const appServer = app.getHttpServer();

    const tenantALogin = await request(appServer).post('/auth/login').send({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });
    expect(tenantALogin.status).toBe(201);

    const tenantBLogin = await request(appServer).post('/auth/login').send({
      email: 'owner@tenant-b.local',
      password: 'tenant-b-pass',
    });
    expect(tenantBLogin.status).toBe(201);

    const issueResponse = await request(appServer)
      .post('/invoices/issue')
      .set('authorization', `Bearer ${tenantALogin.body.accessToken as string}`)
      .send({
        tenantId: 'tenant-b',
        orderId: 'order-1',
        number: '2026-0100',
        currency: 'CZK',
        amountGross: 1200,
        dueAt: new Date('2026-03-31').toISOString(),
      });

    expect(issueResponse.status).toBe(201);
    expect(issueResponse.body.tenantId).toBe('tenant-a');

    const crossTenantPaid = await request(appServer)
      .post('/invoices/paid')
      .set('authorization', `Bearer ${tenantBLogin.body.accessToken as string}`)
      .send({
        invoiceId: issueResponse.body.id,
        paidAt: new Date('2026-04-01').toISOString(),
        version: issueResponse.body.version,
        tenantId: 'tenant-a',
      });

    expect(crossTenantPaid.status).toBe(403);

    const sameTenantPaid = await request(appServer)
      .post('/invoices/paid')
      .set('authorization', `Bearer ${tenantALogin.body.accessToken as string}`)
      .send({
        invoiceId: issueResponse.body.id,
        paidAt: new Date('2026-04-01').toISOString(),
        version: issueResponse.body.version,
        tenantId: 'tenant-b',
      });

    expect(sameTenantPaid.status).toBe(201);
    expect(sameTenantPaid.body.status).toBe('PAID');
  });
});
