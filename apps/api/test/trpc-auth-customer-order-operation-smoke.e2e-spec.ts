import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { randomUUID } from 'crypto';
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

describe('tRPC auth customer -> order -> operation smoke (e2e)', () => {
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

  it('creates customer, order, and operation through the authenticated tRPC flow', async () => {
    const suffix = randomUUID().slice(0, 8);
    const publicClient = createClient();
    const session = await publicClient.auth.login.mutate({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });

    const tenantClient = createClient(session.accessToken);
    const customer = await tenantClient.customer.create.mutate({
      name: `Smoke customer ${suffix}`,
      email: `smoke-customer-${suffix}@example.test`,
    });

    const order = await tenantClient.order.create.mutate({
      tenantId: 'tenant-b',
      customerId: customer.id,
      code: `ORD-SMOKE-${suffix}`,
      title: `Smoke order ${suffix}`,
      status: 'OPEN',
    });

    const operation = await tenantClient.operation.create.mutate({
      tenantId: 'tenant-b',
      orderId: order.id,
      code: `OP-SMOKE-${suffix}`,
      title: `Smoke operation ${suffix}`,
      status: 'READY',
      sortIndex: 1,
    });

    expect(session.tokenType).toBe('Bearer');
    expect(customer.tenantId).toBe('tenant-a');
    expect(order.tenantId).toBe('tenant-a');
    expect(order.customerId).toBe(customer.id);
    expect(operation.tenantId).toBe('tenant-a');
    expect(operation.orderId).toBe(order.id);

    const orders = await tenantClient.order.list.query();
    const operations = await tenantClient.operation.list.query();

    expect(orders.some((item) => item.id === order.id)).toBe(true);
    expect(operations.some((item) => item.id === operation.id)).toBe(true);
  });
});
