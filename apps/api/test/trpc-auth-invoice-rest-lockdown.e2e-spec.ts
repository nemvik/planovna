import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { CashflowService } from '../src/modules/cashflow/cashflow.service';
import { CustomerService } from '../src/modules/customer/customer.service';
import { InvoiceService } from '../src/modules/invoice/invoice.service';
import { OperationService } from '../src/modules/operation/operation.service';
import { OrderService } from '../src/modules/order/order.service';
import { createTrpcContext } from '../src/trpc/context';
import { createAppRouter, type AppRouter } from '../src/trpc/routers/app.router';

describe('tRPC auth+invoice parity with REST lockdown (e2e)', () => {
  let app: INestApplication<App>;
  let baseUrl: string;

  const createClient = (accessToken?: string) =>
    createTRPCProxyClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${baseUrl}/trpc`,
          headers: accessToken
            ? {
                authorization: `Bearer ${accessToken}`,
              }
            : undefined,
        }),
      ],
    });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    const authService = app.get(AuthService);
    const customerService = app.get(CustomerService);
    const invoiceService = app.get(InvoiceService);
    const orderService = app.get(OrderService);
    const operationService = app.get(OperationService);
    const cashflowService = app.get(CashflowService);

    const appRouter = createAppRouter(
      authService,
      customerService,
      invoiceService,
      orderService,
      operationService,
      cashflowService,
    );

    app.use(
      '/trpc',
      createExpressMiddleware({
        router: appRouter,
        createContext: ({ req }) => createTrpcContext({ req, authService }),
      }),
    );

    await app.init();
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 404 for removed REST auth/invoice endpoints while equivalent tRPC procedures stay green', async () => {
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

    const publicClient = createClient();

    const login = await publicClient.auth.login.mutate({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });
    expect(login.tokenType).toBe('Bearer');
    expect(login.accessToken).toBeTruthy();

    const magicLink = await publicClient.auth.requestMagicLink.mutate({
      email: 'owner@tenant-a.local',
    });
    expect(magicLink.token).toBeTruthy();

    const consumed = await publicClient.auth.consumeMagicLink.mutate({
      token: magicLink.token,
    });
    expect(consumed.tokenType).toBe('Bearer');

    const authClient = createClient(login.accessToken);

    const issued = await authClient.invoice.issue.mutate({
      tenantId: 'tenant-b',
      orderId: 'order-trpc-1',
      number: 'INV-TRPC-LOCK-1',
      currency: 'CZK',
      amountGross: 3200,
      dueAt: new Date('2026-04-12').toISOString(),
    });

    expect(issued.tenantId).toBe('tenant-a');

    const paid = await authClient.invoice.paid.mutate({
      invoiceId: issued.id,
      paidAt: new Date('2026-04-13').toISOString(),
      version: issued.version,
    });

    expect(paid.status).toBe('PAID');
  });
});
