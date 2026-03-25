import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { randomUUID } from 'crypto';
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

describe('legacy REST lockdown + tRPC smoke (e2e)', () => {
  let app: INestApplication<App>;
  let baseUrl: string;

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

  it('returns 404 for legacy REST customer/order/operation endpoints', async () => {
    await request(baseUrl)
      .post('/customers')
      .send({ name: 'Legacy customer', email: 'legacy@example.com', tenantId: 'tenant-a' })
      .expect(404);

    await request(baseUrl).get('/customers/tenant-a').expect(404);

    await request(baseUrl)
      .post('/orders')
      .send({
        tenantId: 'tenant-a',
        customerId: 'c-1',
        code: 'ORD-LEGACY',
        title: 'Legacy order',
      })
      .expect(404);

    await request(baseUrl)
      .post('/operations')
      .send({
        tenantId: 'tenant-a',
        orderId: 'o-1',
        code: 'OP-LEGACY',
        title: 'Legacy operation',
      })
      .expect(404);
  });

  it('keeps tRPC customer/order/operation flows reachable', async () => {
    const suffix = randomUUID().slice(0, 8);
    const loginClient = createTRPCProxyClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${baseUrl}/trpc`,
        }),
      ],
    });

    const tenantA = await loginClient.auth.login.mutate({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });

    const tenantAClient = createTRPCProxyClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${baseUrl}/trpc`,
          headers: {
            authorization: `Bearer ${tenantA.accessToken}`,
          },
        }),
      ],
    });

    const customer = await tenantAClient.customer.create.mutate({
      name: `tRPC customer ${suffix}`,
      email: `trpc-customer-${suffix}@example.com`,
    });

    const order = await tenantAClient.order.create.mutate({
      tenantId: 'tenant-b',
      customerId: customer.id,
      code: `ORD-TRPC-LOCKDOWN-${suffix}`,
      title: `tRPC order ${suffix}`,
    });

    const operation = await tenantAClient.operation.create.mutate({
      tenantId: 'tenant-b',
      orderId: order.id,
      code: `OP-TRPC-LOCKDOWN-${suffix}`,
      title: `tRPC operation ${suffix}`,
    });

    expect(customer.tenantId).toBe('tenant-a');
    expect(order.tenantId).toBe('tenant-a');
    expect(operation.tenantId).toBe('tenant-a');

    const customers = await tenantAClient.customer.list.query();
    const orders = await tenantAClient.order.list.query();
    const operations = await tenantAClient.operation.list.query();

    expect(customers.some((item) => item.id === customer.id)).toBe(true);
    expect(orders.some((item) => item.id === order.id)).toBe(true);
    expect(operations.some((item) => item.id === operation.id)).toBe(true);
  });
});
