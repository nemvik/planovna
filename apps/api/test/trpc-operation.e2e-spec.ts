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
import { PrismaService } from '../src/prisma/prisma.service';
import { createTrpcContext } from '../src/trpc/context';
import { createAppRouter, type AppRouter } from '../src/trpc/routers/app.router';

describe('tRPC operation contracts (e2e)', () => {
  let app: INestApplication<App> | null = null;
  let baseUrl: string;
  let authService: AuthService;
  let prismaService: PrismaService;

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

  const createOperationOrder = async (
    client: ReturnType<typeof createClient>,
    tenantKey: string,
  ) => {
    const suffix = uniqueSuffix();
    const customer = await client.customer.create.mutate({
      name: `Operation customer ${tenantKey} ${suffix}`,
      email: `operation-${tenantKey}-${suffix}@example.test`,
    });

    return client.order.create.mutate({
      tenantId: tenantKey,
      customerId: customer.id,
      code: `ORD-OP-${suffix}`,
      title: `Operation order ${tenantKey} ${suffix}`,
      status: 'OPEN',
    });
  };

  const bootstrapApp = async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const nextApp = moduleFixture.createNestApplication();

    authService = nextApp.get(AuthService);
    prismaService = nextApp.get(PrismaService);
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

  it('requires authentication for operation.list/create/update', async () => {
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

    await expect(
      publicClient.operation.update.mutate({
        id: 'op-unauth',
        tenantId: 'tenant-a',
        version: 1,
        title: 'Unauthorized update',
      }),
    ).rejects.toMatchObject({
      data: { code: 'UNAUTHORIZED' },
    });
  });

  it('forces tenant from auth context on operation.create even with payload override', async () => {
    const tenantALogin = await authService.login({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });

    expect(tenantALogin).not.toBeNull();

    const tenantAClient = createClient(tenantALogin!.accessToken);
    const order = await createOperationOrder(tenantAClient, 'tenant-a');

    const created = await tenantAClient.operation.create.mutate({
      tenantId: 'tenant-b',
      orderId: order.id,
      code: 'OP-A-OVERRIDE',
      title: 'Tenant override attempt',
      status: 'READY',
      sortIndex: 1,
    });

    expect(created.tenantId).toBe('tenant-a');

    const tenantAList = await tenantAClient.operation.list.query();
    expect(tenantAList.some((operation) => operation.id === created.id)).toBe(true);
  });

  it('denies cross-tenant update and keeps original operation data unchanged', async () => {
    const tenantALogin = await authService.login({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });
    const tenantBLogin = await authService.login({
      email: 'owner@tenant-b.local',
      password: 'tenant-b-pass',
    });

    expect(tenantALogin).not.toBeNull();
    expect(tenantBLogin).not.toBeNull();

    const tenantAClient = createClient(tenantALogin!.accessToken);
    const tenantBClient = createClient(tenantBLogin!.accessToken);
    const order = await createOperationOrder(tenantAClient, 'tenant-a');

    const created = await tenantAClient.operation.create.mutate({
      tenantId: 'tenant-a',
      orderId: order.id,
      code: 'OP-A-UPDATE',
      title: 'Original operation title',
      status: 'READY',
      sortIndex: 2,
    });

    await expect(
      tenantBClient.operation.update.mutate({
        id: created.id,
        tenantId: 'tenant-a',
        version: created.version,
        title: 'Cross tenant overwrite',
        status: 'DONE',
      }),
    ).rejects.toMatchObject({
      data: { code: 'FORBIDDEN' },
    });

    const tenantAList = await tenantAClient.operation.list.query();
    const stored = tenantAList.find((operation) => operation.id === created.id);

    expect(stored).toBeDefined();
    expect(stored?.title).toBe('Original operation title');
    expect(stored?.status).toBe('READY');
    expect(stored?.version).toBe(1);
  });

  it('surfaces version-conflict path on stale operation.update', async () => {
    const tenantALogin = await authService.login({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });

    expect(tenantALogin).not.toBeNull();

    const tenantAClient = createClient(tenantALogin!.accessToken);
    const order = await createOperationOrder(tenantAClient, 'tenant-a');

    const created = await tenantAClient.operation.create.mutate({
      tenantId: 'tenant-a',
      orderId: order.id,
      code: 'OP-A-VERSION',
      title: 'Versioned operation',
      status: 'READY',
      sortIndex: 3,
    });

    const updated = await tenantAClient.operation.update.mutate({
      id: created.id,
      tenantId: 'tenant-b',
      version: created.version,
      title: 'Updated operation title',
      status: 'IN_PROGRESS',
    });

    expect(updated).toBeDefined();
    expect(updated?.tenantId).toBe('tenant-a');
    expect(updated?.version).toBe(2);

    await expect(
      tenantAClient.operation.update.mutate({
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
          entity: 'Operation',
          id: created.id,
          expectedVersion: created.version,
          actualVersion: updated?.version,
        },
      },
    });
  });

  it('clears a persisted startDate via operation.update when the payload sends null', async () => {
    const tenantALogin = await authService.login({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });

    expect(tenantALogin).not.toBeNull();

    const tenantAClient = createClient(tenantALogin!.accessToken);
    const order = await createOperationOrder(tenantAClient, 'tenant-a');

    const created = await tenantAClient.operation.create.mutate({
      tenantId: 'tenant-a',
      orderId: order.id,
      code: `OP-A-START-CLEAR-${uniqueSuffix()}`,
      title: 'Operation with start date',
      status: 'READY',
      startDate: '2026-03-10T00:00:00.000Z',
      sortIndex: 3,
    });

    const cleared = await tenantAClient.operation.update.mutate({
      id: created.id,
      tenantId: 'tenant-a',
      version: created.version,
      startDate: null,
    });

    expect(cleared).toBeDefined();
    expect(cleared?.startDate).toBeUndefined();
    expect(cleared?.version).toBe(created.version + 1);

    const tenantAList = await tenantAClient.operation.list.query();
    const stored = tenantAList.find((operation) => operation.id === created.id);

    expect(stored).toBeDefined();
    expect(stored?.id).toBe(created.id);
    expect(stored?.startDate).toBeUndefined();
    expect(stored?.version).toBe(created.version + 1);
  });

  it('clears a persisted endDate via operation.update when the payload sends null', async () => {
    const tenantALogin = await authService.login({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });

    expect(tenantALogin).not.toBeNull();

    const tenantAClient = createClient(tenantALogin!.accessToken);
    const order = await createOperationOrder(tenantAClient, 'tenant-a');

    const created = await tenantAClient.operation.create.mutate({
      tenantId: 'tenant-a',
      orderId: order.id,
      code: 'OP-A-END-CLEAR',
      title: 'Operation with end date',
      status: 'READY',
      endDate: '2026-03-10T00:00:00.000Z',
      sortIndex: 3,
    });

    const cleared = await tenantAClient.operation.update.mutate({
      id: created.id,
      tenantId: 'tenant-a',
      version: created.version,
      endDate: null,
    });

    expect(cleared).toBeDefined();
    expect(cleared?.endDate).toBeUndefined();
    expect(cleared?.version).toBe(created.version + 1);

    const tenantAList = await tenantAClient.operation.list.query();
    const stored = tenantAList.find((operation) => operation.id === created.id);

    expect(stored).toBeDefined();
    expect(stored?.id).toBe(created.id);
    expect(stored?.endDate).toBeUndefined();
    expect(stored?.version).toBe(created.version + 1);
  });

  it('clears a persisted blockedReason via operation.update when the payload sends null', async () => {
    const tenantALogin = await authService.login({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });

    expect(tenantALogin).not.toBeNull();

    const tenantAClient = createClient(tenantALogin!.accessToken);
    const order = await createOperationOrder(tenantAClient, 'tenant-a');

    const created = await tenantAClient.operation.create.mutate({
      tenantId: 'tenant-a',
      orderId: order.id,
      code: 'OP-A-BLOCK-CLEAR',
      title: 'Operation with blocked reason',
      status: 'BLOCKED',
      blockedReason: 'Waiting for material',
      sortIndex: 3,
    });

    const cleared = await tenantAClient.operation.update.mutate({
      id: created.id,
      tenantId: 'tenant-a',
      version: created.version,
      blockedReason: null,
    });

    expect(cleared).toBeDefined();
    expect(cleared?.blockedReason).toBeUndefined();
    expect(cleared?.version).toBe(created.version + 1);

    const tenantAList = await tenantAClient.operation.list.query();
    const stored = tenantAList.find((operation) => operation.id === created.id);

    expect(stored).toBeDefined();
    expect(stored?.id).toBe(created.id);
    expect(stored?.blockedReason).toBeUndefined();
    expect(stored?.version).toBe(created.version + 1);
  });

  it('loads persisted operations from Prisma after app restart for the same tenant', async () => {
    const tenantALogin = await authService.login({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });

    expect(tenantALogin).not.toBeNull();

    const accessToken = tenantALogin!.accessToken;
    const tenantAClient = createClient(accessToken);
    const order = await createOperationOrder(tenantAClient, 'tenant-a');

    const created = await tenantAClient.operation.create.mutate({
      tenantId: 'tenant-a',
      orderId: order.id,
      code: `OP-A-RESTART-${uniqueSuffix()}`,
      title: 'Restart persistence operation',
      status: 'IN_PROGRESS',
      sortIndex: 4,
    });

    await closeApp();
    await bootstrapApp();

    const restartedTenantAClient = createClient(accessToken);
    const tenantAList = await restartedTenantAClient.operation.list.query();
    const persisted = tenantAList.find((operation) => operation.id === created.id);

    expect(persisted).toMatchObject({
      id: created.id,
      tenantId: 'tenant-a',
      orderId: order.id,
      code: created.code,
      title: 'Restart persistence operation',
      status: 'IN_PROGRESS',
      sortIndex: 4,
      version: 1,
    });
  });

  it('keeps operation.list tenant-scoped for operations created via tRPC', async () => {
    const tenantALogin = await authService.login({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });
    const tenantBLogin = await authService.login({
      email: 'owner@tenant-b.local',
      password: 'tenant-b-pass',
    });

    expect(tenantALogin).not.toBeNull();
    expect(tenantBLogin).not.toBeNull();

    const tenantAClient = createClient(tenantALogin!.accessToken);
    const tenantBClient = createClient(tenantBLogin!.accessToken);
    const tenantBOrder = await createOperationOrder(tenantBClient, 'tenant-b');

    const createdByTenantB = await tenantBClient.operation.create.mutate({
      tenantId: 'tenant-a',
      orderId: tenantBOrder.id,
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

  it('adds and removes same-tenant dependencies through tRPC', async () => {
    const tenantALogin = await authService.login({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });

    expect(tenantALogin).not.toBeNull();

    const tenantAClient = createClient(tenantALogin!.accessToken);
    const order = await createOperationOrder(tenantAClient, 'tenant-a');
    const prerequisite = await tenantAClient.operation.create.mutate({
      tenantId: 'tenant-a',
      orderId: order.id,
      code: `OP-A-PREREQ-${uniqueSuffix()}`,
      title: 'Prerequisite operation',
      status: 'DONE',
      sortIndex: 1,
    });
    const blocked = await tenantAClient.operation.create.mutate({
      tenantId: 'tenant-a',
      orderId: order.id,
      code: `OP-A-BLOCKED-${uniqueSuffix()}`,
      title: 'Blocked operation',
      status: 'READY',
      sortIndex: 2,
    });

    const withDependency = await tenantAClient.operation.addDependency.mutate({
      operationId: blocked.id,
      dependsOnId: prerequisite.id,
    });

    expect(withDependency).toMatchObject({
      id: blocked.id,
      dependencyCount: 1,
      prerequisiteCodes: [prerequisite.code],
      prerequisiteOverflowCount: 0,
    });

    const withoutDependency = await tenantAClient.operation.removeDependency.mutate({
      operationId: blocked.id,
      dependsOnId: prerequisite.id,
    });

    expect(withoutDependency).toMatchObject({
      id: blocked.id,
      dependencyCount: 0,
      prerequisiteCodes: [],
      prerequisiteOverflowCount: 0,
    });
  });

  it('rejects self, duplicate, cross-tenant, and cyclic dependencies', async () => {
    const tenantALogin = await authService.login({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });
    const tenantBLogin = await authService.login({
      email: 'owner@tenant-b.local',
      password: 'tenant-b-pass',
    });

    expect(tenantALogin).not.toBeNull();
    expect(tenantBLogin).not.toBeNull();

    const tenantAClient = createClient(tenantALogin!.accessToken);
    const tenantBClient = createClient(tenantBLogin!.accessToken);
    const order = await createOperationOrder(tenantAClient, 'tenant-a');
    const tenantBOrder = await createOperationOrder(tenantBClient, 'tenant-b');

    const opA = await tenantAClient.operation.create.mutate({ tenantId: 'tenant-a', orderId: order.id, code: `OP-A-${uniqueSuffix()}`, title: 'A', status: 'READY', sortIndex: 1 });
    const opB = await tenantAClient.operation.create.mutate({ tenantId: 'tenant-a', orderId: order.id, code: `OP-B-${uniqueSuffix()}`, title: 'B', status: 'READY', sortIndex: 2 });
    const opC = await tenantAClient.operation.create.mutate({ tenantId: 'tenant-a', orderId: order.id, code: `OP-C-${uniqueSuffix()}`, title: 'C', status: 'READY', sortIndex: 3 });
    const opTenantB = await tenantBClient.operation.create.mutate({ tenantId: 'tenant-b', orderId: tenantBOrder.id, code: `OP-BX-${uniqueSuffix()}`, title: 'BX', status: 'READY', sortIndex: 1 });

    await expect(
      tenantAClient.operation.addDependency.mutate({ operationId: opA.id, dependsOnId: opA.id }),
    ).rejects.toMatchObject({ data: { code: 'BAD_REQUEST' } });

    const created = await tenantAClient.operation.addDependency.mutate({ operationId: opB.id, dependsOnId: opA.id });
    expect(created.dependencyCount).toBe(1);

    await expect(
      tenantAClient.operation.addDependency.mutate({ operationId: opB.id, dependsOnId: opA.id }),
    ).rejects.toMatchObject({ data: { code: 'CONFLICT' } });

    await expect(
      tenantAClient.operation.addDependency.mutate({ operationId: opB.id, dependsOnId: opTenantB.id }),
    ).rejects.toMatchObject({ data: { code: 'BAD_REQUEST' } });

    await tenantAClient.operation.addDependency.mutate({ operationId: opC.id, dependsOnId: opB.id });

    await expect(
      tenantAClient.operation.addDependency.mutate({ operationId: opA.id, dependsOnId: opC.id }),
    ).rejects.toMatchObject({ data: { code: 'BAD_REQUEST' } });
  });

  it('records board audit events for operation updates and dependency changes', async () => {
    const tenantALogin = await authService.login({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });

    expect(tenantALogin).not.toBeNull();

    const tenantAClient = createClient(tenantALogin!.accessToken);
    const order = await createOperationOrder(tenantAClient, 'tenant-a');
    const prerequisite = await tenantAClient.operation.create.mutate({
      tenantId: 'tenant-a',
      orderId: order.id,
      code: `OP-A-AUDIT-P-${uniqueSuffix()}`,
      title: 'Audit prerequisite',
      status: 'READY',
      sortIndex: 1,
    });
    const operation = await tenantAClient.operation.create.mutate({
      tenantId: 'tenant-a',
      orderId: order.id,
      code: `OP-A-AUDIT-${uniqueSuffix()}`,
      title: 'Audit operation',
      status: 'READY',
      sortIndex: 2,
    });

    await tenantAClient.operation.update.mutate({
      id: operation.id,
      tenantId: 'tenant-a',
      version: operation.version,
      status: 'IN_PROGRESS',
      startDate: '2026-03-11T00:00:00.000Z',
      sortIndex: 3000,
    });
    await tenantAClient.operation.addDependency.mutate({
      operationId: operation.id,
      dependsOnId: prerequisite.id,
    });
    await tenantAClient.operation.removeDependency.mutate({
      operationId: operation.id,
      dependsOnId: prerequisite.id,
    });

    const events = await tenantAClient.operation.auditLog.query();

    expect(events.some((event) => event.action === 'create' && event.entityId === operation.id)).toBe(true);
    expect(events.some((event) => event.action === 'update' && event.entityId === operation.id)).toBe(true);
    expect(events.some((event) => event.action === 'dependency_add' && event.entityId === operation.id)).toBe(true);
    expect(events.some((event) => event.action === 'dependency_remove' && event.entityId === operation.id)).toBe(true);
  });

  it('exposes capped same-tenant prerequisite codes on operation.list payloads', async () => {
    const tenantALogin = await authService.login({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });
    const tenantBLogin = await authService.login({
      email: 'owner@tenant-b.local',
      password: 'tenant-b-pass',
    });

    expect(tenantALogin).not.toBeNull();
    expect(tenantBLogin).not.toBeNull();

    const tenantAClient = createClient(tenantALogin!.accessToken);
    const tenantBClient = createClient(tenantBLogin!.accessToken);
    const order = await createOperationOrder(tenantAClient, 'tenant-a');
    const tenantBOrder = await createOperationOrder(tenantBClient, 'tenant-b');

    const prerequisiteOne = await tenantAClient.operation.create.mutate({
      tenantId: 'tenant-a',
      orderId: order.id,
      code: 'OP-120',
      title: 'Prerequisite operation 1',
      status: 'DONE',
      sortIndex: 1,
    });
    const prerequisiteTwo = await tenantAClient.operation.create.mutate({
      tenantId: 'tenant-a',
      orderId: order.id,
      code: 'OP-130',
      title: 'Prerequisite operation 2',
      status: 'DONE',
      sortIndex: 2,
    });
    const prerequisiteThree = await tenantAClient.operation.create.mutate({
      tenantId: 'tenant-a',
      orderId: order.id,
      code: 'OP-140',
      title: 'Prerequisite operation 3',
      status: 'DONE',
      sortIndex: 3,
    });
    const prerequisiteFour = await tenantAClient.operation.create.mutate({
      tenantId: 'tenant-a',
      orderId: order.id,
      code: 'OP-150',
      title: 'Prerequisite operation 4',
      status: 'DONE',
      sortIndex: 4,
    });
    const blocked = await tenantAClient.operation.create.mutate({
      tenantId: 'tenant-a',
      orderId: order.id,
      code: `OP-A-BLOCKED-${uniqueSuffix()}`,
      title: 'Blocked operation',
      status: 'READY',
      sortIndex: 5,
    });
    const unblocked = await tenantAClient.operation.create.mutate({
      tenantId: 'tenant-a',
      orderId: order.id,
      code: `OP-A-FREE-${uniqueSuffix()}`,
      title: 'Unblocked operation',
      status: 'READY',
      sortIndex: 6,
    });
    const crossTenantPrerequisite = await tenantBClient.operation.create.mutate({
      tenantId: 'tenant-b',
      orderId: tenantBOrder.id,
      code: 'OP-999',
      title: 'Cross-tenant prerequisite',
      status: 'DONE',
      sortIndex: 1,
    });

    await prismaService.operationDependency.createMany({
      data: [
        {
          tenantId: 'tenant-a',
          operationId: blocked.id,
          dependsOnId: prerequisiteOne.id,
        },
        {
          tenantId: 'tenant-a',
          operationId: blocked.id,
          dependsOnId: prerequisiteTwo.id,
        },
        {
          tenantId: 'tenant-a',
          operationId: blocked.id,
          dependsOnId: prerequisiteThree.id,
        },
        {
          tenantId: 'tenant-a',
          operationId: blocked.id,
          dependsOnId: prerequisiteFour.id,
        },
        {
          tenantId: 'tenant-b',
          operationId: blocked.id,
          dependsOnId: crossTenantPrerequisite.id,
        },
      ],
    });

    const tenantAList = await tenantAClient.operation.list.query();

    expect(tenantAList.find((operation) => operation.id === blocked.id)).toMatchObject({
      id: blocked.id,
      dependencyCount: 4,
      prerequisiteCodes: ['OP-120', 'OP-130', 'OP-140'],
      prerequisiteOverflowCount: 1,
    });
    expect(tenantAList.find((operation) => operation.id === unblocked.id)).toMatchObject({
      id: unblocked.id,
      dependencyCount: 0,
      prerequisiteCodes: [],
      prerequisiteOverflowCount: 0,
    });
  });
});
