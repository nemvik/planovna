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

describe('tRPC operation contracts (e2e)', () => {
  let app: INestApplication<App>;
  let baseUrl: string;
  let authService: AuthService;

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
    const operationService = app.get(OperationService);

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

  it('requires authentication for operation.list and operation.create', async () => {
    const publicClient = createClient();

    await expect(publicClient.operation.list.query()).rejects.toMatchObject({
      data: { code: 'UNAUTHORIZED' },
    });

    await expect(
      publicClient.operation.create.mutate({
        tenantId: 'tenant-a',
        orderId: 'order-a-1',
        code: 'OP-UNAUTH',
        title: 'Unauthorized operation create',
      }),
    ).rejects.toMatchObject({
      data: { code: 'UNAUTHORIZED' },
    });
  });

  it('forces tenant from auth context on operation.create even with payload override', async () => {
    const tenantALogin = authService.login({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });

    expect(tenantALogin).not.toBeNull();

    const tenantAClient = createClient(tenantALogin!.accessToken);

    const created = await tenantAClient.operation.create.mutate({
      tenantId: 'tenant-b',
      orderId: 'order-a-1',
      code: 'OP-A-OVERRIDE',
      title: 'Tenant override attempt',
      status: 'READY',
      sortIndex: 1,
    });

    expect(created.tenantId).toBe('tenant-a');

    const tenantAList = await tenantAClient.operation.list.query();
    expect(tenantAList.some((operation) => operation.id === created.id)).toBe(true);
  });

  it('keeps operation.list tenant-scoped for operations created via tRPC', async () => {
    const tenantALogin = authService.login({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });
    const tenantBLogin = authService.login({
      email: 'owner@tenant-b.local',
      password: 'tenant-b-pass',
    });

    expect(tenantALogin).not.toBeNull();
    expect(tenantBLogin).not.toBeNull();

    const tenantAClient = createClient(tenantALogin!.accessToken);
    const tenantBClient = createClient(tenantBLogin!.accessToken);

    const createdByTenantB = await tenantBClient.operation.create.mutate({
      tenantId: 'tenant-a',
      orderId: 'order-b-1',
      code: 'OP-B-1',
      title: 'Tenant B operation',
      status: 'READY',
      sortIndex: 1,
    });

    expect(createdByTenantB.tenantId).toBe('tenant-b');

    const tenantAList = await tenantAClient.operation.list.query();
    expect(tenantAList.some((operation) => operation.id === createdByTenantB.id)).toBe(
      false,
    );

    const tenantBList = await tenantBClient.operation.list.query();
    expect(tenantBList.some((operation) => operation.id === createdByTenantB.id)).toBe(true);
  });
});
