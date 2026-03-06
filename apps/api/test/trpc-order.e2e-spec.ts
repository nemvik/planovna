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

describe('tRPC order contracts (e2e)', () => {
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

    const created = await ownerClient.order.create.mutate({
      tenantId: 'tenant-b',
      customerId: 'c-override',
      code: 'ORD-101',
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

    const created = await tenantAClient.order.create.mutate({
      tenantId: 'tenant-a',
      customerId: 'c-a',
      code: 'ORD-102',
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

    const created = await ownerClient.order.create.mutate({
      tenantId: 'tenant-a',
      customerId: 'c-version',
      code: 'ORD-103',
      title: 'Versioned order',
    });

    const updated = await ownerClient.order.update.mutate({
      id: created.id,
      tenantId: 'tenant-b',
      version: created.version,
      title: 'Versioned order updated',
    });

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
});
