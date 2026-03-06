import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { CustomerService } from '../src/modules/customer/customer.service';
import { InvoiceService } from '../src/modules/invoice/invoice.service';
import { OperationService } from '../src/modules/operation/operation.service';
import { OrderService } from '../src/modules/order/order.service';
import { createTrpcContext } from '../src/trpc/context';
import { createAppRouter, type AppRouter } from '../src/trpc/routers/app.router';

describe('tRPC operation list contracts (e2e)', () => {
  let app: INestApplication<App>;
  let baseUrl: string;
  let authService: AuthService;
  let operationService: OperationService;

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

    authService = app.get(AuthService);
    const customerService = app.get(CustomerService);
    const invoiceService = app.get(InvoiceService);
    const orderService = app.get(OrderService);
    operationService = app.get(OperationService);

    const appRouter = createAppRouter(
      authService,
      customerService,
      invoiceService,
      orderService,
      operationService,
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

  it('requires authentication for operation.list', async () => {
    const publicClient = createClient();

    await expect(publicClient.operation.list.query()).rejects.toMatchObject({
      data: { code: 'UNAUTHORIZED' },
    });
  });

  it('returns only operations scoped to auth tenant', async () => {
    operationService.create({
      tenantId: 'tenant-a',
      orderId: 'order-a-1',
      code: 'OP-A-1',
      title: 'Tenant A operation',
      status: 'READY',
      sortIndex: 1,
    });

    operationService.create({
      tenantId: 'tenant-b',
      orderId: 'order-b-1',
      code: 'OP-B-1',
      title: 'Tenant B operation',
      status: 'READY',
      sortIndex: 1,
    });

    const tenantALogin = authService.login({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });
    expect(tenantALogin).not.toBeNull();

    const tenantAClient = createClient(tenantALogin!.accessToken);
    const listed = await tenantAClient.operation.list.query();

    expect(listed).toHaveLength(1);
    expect(listed[0]?.tenantId).toBe('tenant-a');
    expect(listed[0]?.code).toBe('OP-A-1');
    expect(listed.some((operation) => operation.tenantId === 'tenant-b')).toBe(false);
  });
});
