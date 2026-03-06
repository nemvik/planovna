import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Legacy REST invoice lockdown (e2e)', () => {
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

  it('returns 404 on removed invoice REST endpoints', async () => {
    const appServer = app.getHttpServer();

    await request(appServer)
      .post('/invoices/issue')
      .set('authorization', 'Bearer any-token')
      .send({
        orderId: 'order-1',
        number: 'INV-REST-LOCK',
        currency: 'CZK',
        amountGross: 1000,
        dueAt: new Date('2026-04-10').toISOString(),
      })
      .expect(404);

    await request(appServer)
      .post('/invoices/paid')
      .set('authorization', 'Bearer any-token')
      .send({
        invoiceId: 'invoice-1',
        paidAt: new Date('2026-04-11').toISOString(),
        version: 1,
      })
      .expect(404);
  });
});
