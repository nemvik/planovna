import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
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

describe('tRPC invoice write contracts (e2e)', () => {
  let app: INestApplication<App>;
  let baseUrl: string;
  let authService: AuthService;
  let cashflowService: CashflowService;

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
    cashflowService = app.get(CashflowService);

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

  it('enforces auth and roles for invoice.issue and invoice.paid', async () => {
    const publicClient = createClient();

    await expect(
      publicClient.invoice.issue.mutate({
        tenantId: 'tenant-b',
        orderId: 'order-authz-1',
        number: 'INV-TRPC-100',
        currency: 'CZK',
        amountGross: 1000,
        dueAt: new Date('2026-04-10').toISOString(),
      }),
    ).rejects.toMatchObject({ data: { code: 'UNAUTHORIZED' } });

    await expect(
      publicClient.invoice.paid.mutate({
        invoiceId: 'missing',
        paidAt: new Date('2026-04-11').toISOString(),
        version: 1,
      }),
    ).rejects.toMatchObject({ data: { code: 'UNAUTHORIZED' } });

    const plannerLogin = authService.login({
      email: 'planner@tenant-a.local',
      password: 'tenant-a-pass',
    });
    expect(plannerLogin).not.toBeNull();

    const plannerClient = createClient(plannerLogin!.accessToken);

    await expect(
      plannerClient.invoice.issue.mutate({
        tenantId: 'tenant-a',
        orderId: 'order-authz-2',
        number: 'INV-TRPC-101',
        currency: 'CZK',
        amountGross: 1500,
        dueAt: new Date('2026-04-10').toISOString(),
      }),
    ).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
  });

  it('covers invalid input, not-found and version-conflict paths for invoice writes', async () => {
    const ownerLogin = authService.login({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });
    expect(ownerLogin).not.toBeNull();

    const ownerClient = createClient(ownerLogin!.accessToken);

    await expect(
      ownerClient.invoice.issue.mutate({
        tenantId: 'tenant-a',
        orderId: 'order-invalid-1',
        number: 'INV-TRPC-INVALID',
        currency: 'CZK',
        amountGross: -10,
        dueAt: new Date('2026-04-10').toISOString(),
      }),
    ).rejects.toMatchObject({ data: { code: 'BAD_REQUEST' } });

    await expect(
      ownerClient.invoice.paid.mutate({
        invoiceId: 'invoice-does-not-exist',
        paidAt: new Date('2026-04-11').toISOString(),
        version: 1,
      }),
    ).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });

    const issued = await ownerClient.invoice.issue.mutate({
      tenantId: 'tenant-a',
      orderId: 'order-conflict-1',
      number: 'INV-TRPC-CONFLICT',
      currency: 'CZK',
      amountGross: 900,
      dueAt: new Date('2026-04-12').toISOString(),
    });

    const firstPaid = await ownerClient.invoice.paid.mutate({
      invoiceId: issued.id,
      paidAt: new Date('2026-04-13').toISOString(),
      version: issued.version,
    });
    expect(firstPaid.status).toBe('PAID');

    await expect(
      ownerClient.invoice.paid.mutate({
        invoiceId: issued.id,
        paidAt: new Date('2026-04-14').toISOString(),
        version: issued.version,
      }),
    ).rejects.toMatchObject({ data: { code: 'INTERNAL_SERVER_ERROR' } });
  });

  it('resolves tenant from token and blocks cross-tenant paid side effects', async () => {
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

    const issued = await tenantAClient.invoice.issue.mutate({
      tenantId: 'tenant-b',
      orderId: 'order-cross-1',
      number: 'INV-TRPC-200',
      currency: 'CZK',
      amountGross: 2100,
      dueAt: new Date('2026-04-12').toISOString(),
    });

    expect(issued.tenantId).toBe('tenant-a');

    await expect(
      tenantBClient.invoice.paid.mutate({
        invoiceId: issued.id,
        paidAt: new Date('2026-04-13').toISOString(),
        version: issued.version,
        tenantId: 'tenant-a',
      }),
    ).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });

    const aItemsAfterCrossTry = cashflowService.list('tenant-a');
    const bItemsAfterCrossTry = cashflowService.list('tenant-b');

    expect(aItemsAfterCrossTry.filter((x) => x.kind === 'PLANNED_IN')).toHaveLength(1);
    expect(aItemsAfterCrossTry.filter((x) => x.kind === 'ACTUAL_IN')).toHaveLength(0);
    expect(bItemsAfterCrossTry).toHaveLength(0);

    const paid = await tenantAClient.invoice.paid.mutate({
      invoiceId: issued.id,
      paidAt: new Date('2026-04-13').toISOString(),
      version: issued.version,
      tenantId: 'tenant-b',
    });

    expect(paid.status).toBe('PAID');

    const aItemsAfterSuccess = cashflowService.list('tenant-a');
    expect(aItemsAfterSuccess.filter((x) => x.kind === 'ACTUAL_IN')).toHaveLength(1);
  });
});
