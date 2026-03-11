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

describe('tRPC order contracts (e2e)', () => {
  let app: INestApplication<App> | null = null;
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

  const uniqueSuffix = () => randomUUID().slice(0, 8);

  const createOrderCustomer = async (
    client: ReturnType<typeof createClient>,
    tenantKey: string,
  ) => {
    const suffix = uniqueSuffix();

    return client.customer.create.mutate({
      name: `Order customer ${tenantKey} ${suffix}`,
      email: `order-${tenantKey}-${suffix}@example.test`,
    });
  };

  const bootstrapApp = async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const nextApp = moduleFixture.createNestApplication();

    authService = nextApp.get(AuthService);
    const customerService = nextApp.get(CustomerService);
    const invoiceService = nextApp.get(InvoiceService);
    const orderService = nextApp.get(OrderService);
    const operationService = nextApp.get(OperationService);
    const cashflowService = nextApp.get(CashflowService);

    const appRouter = createAppRouter(
      authService,
      customerService,
      invoiceService,
      orderService,
      operationService,
      cashflowService,
    );

    nextApp.use(
      '/trpc',
      createExpressMiddleware({
        router: appRouter,
        createContext: ({ req }) => createTrpcContext({ req, authService }),
      }),
    );

    await nextApp.init();
    await nextApp.listen(0);

    app = nextApp;
    baseUrl = await nextApp.getUrl();
  };

  const closeApp = async () => {
    if (!app) {
      return;
    }

    await app.close();
    app = null;
  };

  beforeEach(async () => {
    await bootstrapApp();
  });

  afterEach(async () => {
    await closeApp();
  });

  it('requires authentication for order list/create/update', async () => {
    const publicClient = createClient();

    await expect(publicClient.order.list.query()).rejects.toMatchObject({
      data: { code: 'UNAUTHORIZED' },
    });

    await expect(
      publicClient.order.create.mutate({
        tenantId: 'tenant-a',
        customerId: 'c-1',
        code: 'ORD-100',
        title: 'Unauthorized create',
      }),
    ).rejects.toMatchObject({
      data: { code: 'UNAUTHORIZED' },
    });

    await expect(
      publicClient.order.update.mutate({
        id: 'o-1',
        tenantId: 'tenant-a',
        version: 1,
        title: 'Unauthorized update',
      }),
    ).rejects.toMatchObject({
      data: { code: 'UNAUTHORIZED' },
    });
  });

  it('resolves tenant from auth token on create even when payload tries to override', async () => {
    const ownerLogin = authService.login({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });
    expect(ownerLogin).not.toBeNull();

    const ownerClient = createClient(ownerLogin!.accessToken);
    const customer = await createOrderCustomer(ownerClient, 'tenant-a');
    const suffix = uniqueSuffix();

    const created = await ownerClient.order.create.mutate({
      tenantId: 'tenant-b',
      customerId: customer.id,
      code: `ORD-101-${suffix}`,
      title: 'Tenant override attempt',
    });

    expect(created.tenantId).toBe('tenant-a');

    const listed = await ownerClient.order.list.query();
    expect(listed.some((order) => order.id === created.id)).toBe(true);
  });

  it('denies cross-tenant update and keeps original order data unchanged', async () => {
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
    const customer = await createOrderCustomer(tenantAClient, 'tenant-a');
    const suffix = uniqueSuffix();

    const created = await tenantAClient.order.create.mutate({
      tenantId: 'tenant-a',
      customerId: customer.id,
      code: `ORD-102-${suffix}`,
      title: 'Original title',
      status: 'OPEN',
    });

    await expect(
      tenantBClient.order.update.mutate({
        id: created.id,
        tenantId: 'tenant-a',
        version: created.version,
        title: 'Cross tenant overwrite',
        status: 'DONE',
      }),
    ).rejects.toMatchObject({
      data: { code: 'FORBIDDEN' },
    });

    const tenantAList = await tenantAClient.order.list.query();
    const stored = tenantAList.find((order) => order.id === created.id);

    expect(stored).toBeDefined();
    expect(stored?.title).toBe('Original title');
    expect(stored?.status).toBe('OPEN');
    expect(stored?.version).toBe(1);
  });

  it('surfaces version-conflict path on stale order.update', async () => {
    const ownerLogin = authService.login({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });
    expect(ownerLogin).not.toBeNull();

    const ownerClient = createClient(ownerLogin!.accessToken);
    const customer = await createOrderCustomer(ownerClient, 'tenant-a');
    const suffix = uniqueSuffix();

    const created = await ownerClient.order.create.mutate({
      tenantId: 'tenant-a',
      customerId: customer.id,
      code: `ORD-103-${suffix}`,
      title: 'Versioned order',
    });

    const updated = await ownerClient.order.update.mutate({
      id: created.id,
      tenantId: 'tenant-b',
      version: created.version,
      title: 'Versioned order updated',
    });

    expect(updated.tenantId).toBe('tenant-a');
    expect(updated.version).toBe(2);

    await expect(
      ownerClient.order.update.mutate({
        id: created.id,
        tenantId: 'tenant-a',
        version: created.version,
        title: 'Stale write',
      }),
    ).rejects.toMatchObject({
      data: {
        code: 'CONFLICT',
        conflict: {
          code: 'VERSION_CONFLICT',
          entity: 'Order',
          id: created.id,
          expectedVersion: created.version,
          actualVersion: updated.version,
        },
      },
    });
  });

  it('loads persisted orders from Prisma after app restart for the same tenant', async () => {
    const tenantALogin = authService.login({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });

    expect(tenantALogin).not.toBeNull();

    const accessToken = tenantALogin!.accessToken;
    const tenantAClient = createClient(accessToken);
    const customer = await createOrderCustomer(tenantAClient, 'tenant-a');

    const created = await tenantAClient.order.create.mutate({
      tenantId: 'tenant-a',
      customerId: customer.id,
      code: `ORD-RESTART-${uniqueSuffix()}`,
      title: 'Restart persistence order',
      status: 'OPEN',
    });

    await closeApp();
    await bootstrapApp();

    const restartedTenantAClient = createClient(accessToken);
    const tenantAList = await restartedTenantAClient.order.list.query();
    const persisted = tenantAList.find((order) => order.id === created.id);

    expect(persisted).toMatchObject({
      id: created.id,
      tenantId: 'tenant-a',
      customerId: customer.id,
      code: created.code,
      title: 'Restart persistence order',
      status: 'OPEN',
      version: 1,
    });
  });
});
