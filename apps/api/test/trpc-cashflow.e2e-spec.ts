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

describe('tRPC cashflow read contracts (e2e)', () => {
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

  const uniqueSuffix = () => randomUUID().slice(0, 8);

  const createInvoiceOrder = async (
    client: ReturnType<typeof createClient>,
    tenantKey: 'tenant-a' | 'tenant-b',
  ) => {
    const suffix = uniqueSuffix();
    const customer = await client.customer.create.mutate({
      tenantId: tenantKey,
      name: `Cashflow invoice customer ${tenantKey} ${suffix}`,
      email: `cashflow-invoice-${tenantKey}-${suffix}@example.test`,
    });

    return client.order.create.mutate({
      tenantId: tenantKey,
      customerId: customer.id,
      code: `CASH-INV-ORD-${tenantKey}-${suffix}`,
      title: `Cashflow invoice order ${tenantKey} ${suffix}`,
      status: 'OPEN',
    });
  };

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

  it('enforces auth and role contract for cashflow.list', async () => {
    const publicClient = createClient();

    await expect(publicClient.cashflow.list.query()).rejects.toMatchObject({
      data: { code: 'UNAUTHORIZED' },
    });

    const plannerLogin = await authService.login({
      email: 'planner@tenant-a.local',
      password: 'tenant-a-pass',
    });
    expect(plannerLogin).not.toBeNull();

    const plannerClient = createClient(plannerLogin!.accessToken);

    await expect(plannerClient.cashflow.list.query()).rejects.toMatchObject({
      data: { code: 'FORBIDDEN' },
    });

    const ownerLogin = await authService.login({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });
    const financeLogin = await authService.login({
      email: 'finance@tenant-a.local',
      password: 'tenant-a-pass',
    });

    expect(ownerLogin).not.toBeNull();
    expect(financeLogin).not.toBeNull();

    const ownerClient = createClient(ownerLogin!.accessToken);
    const financeClient = createClient(financeLogin!.accessToken);

    const ownerCashflow = await ownerClient.cashflow.list.query();
    const financeCashflow = await financeClient.cashflow.list.query();

    expect(ownerCashflow.every((item) => item.tenantId === 'tenant-a')).toBe(true);
    expect(financeCashflow.every((item) => item.tenantId === 'tenant-a')).toBe(true);
    expect(financeCashflow.map((item) => item.id).sort()).toEqual(
      ownerCashflow.map((item) => item.id).sort(),
    );
  });

  it('creates, updates, and transitions recurring cashflow rules with tenant scoping', async () => {
    const ownerLogin = await authService.login({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });
    const tenantBLogin = await authService.login({
      email: 'owner@tenant-b.local',
      password: 'tenant-b-pass',
    });

    expect(ownerLogin).not.toBeNull();
    expect(tenantBLogin).not.toBeNull();

    const ownerClient = createClient(ownerLogin!.accessToken);
    const tenantBClient = createClient(tenantBLogin!.accessToken);

    const created = await ownerClient.cashflow.createRecurringRule.mutate({
      label: `Rent ${uniqueSuffix()}`,
      amount: 12000,
      currency: 'CZK',
      interval: 'MONTHLY',
      startDate: new Date('2026-06-01').toISOString(),
      note: 'Workshop rent',
    });

    expect(created.status).toBe('ACTIVE');

    const updated = await ownerClient.cashflow.updateRecurringRule.mutate({
      id: created.id,
      version: created.version,
      amount: 12500,
      note: 'Workshop rent updated',
    });
    expect(updated.amount).toBe(12500);

    const paused = await ownerClient.cashflow.pauseRecurringRule.mutate({
      id: created.id,
      version: updated.version,
    });
    expect(paused.status).toBe('PAUSED');

    const resumed = await ownerClient.cashflow.resumeRecurringRule.mutate({
      id: created.id,
      version: paused.version,
    });
    expect(resumed.status).toBe('ACTIVE');

    const stopped = await ownerClient.cashflow.stopRecurringRule.mutate({
      id: created.id,
      version: resumed.version,
    });
    expect(stopped.status).toBe('STOPPED');

    const listed = await ownerClient.cashflow.listRecurringRules.query();
    expect(listed.some((rule) => rule.id === created.id)).toBe(true);

    await expect(
      ownerClient.cashflow.updateRecurringRule.mutate({
        id: created.id,
        version: created.version,
        amount: 13000,
      }),
    ).rejects.toMatchObject({ data: { code: 'CONFLICT' } });

    await expect(
      tenantBClient.cashflow.pauseRecurringRule.mutate({ id: created.id, version: stopped.version }),
    ).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } });
  });

  it('reflects invoice.issue + invoice.paid lifecycle in tenant-scoped cashflow.list', async () => {
    const ownerLogin = await authService.login({
      email: 'owner@tenant-a.local',
      password: 'tenant-a-pass',
    });
    const financeLogin = await authService.login({
      email: 'finance@tenant-a.local',
      password: 'tenant-a-pass',
    });
    const tenantBLogin = await authService.login({
      email: 'owner@tenant-b.local',
      password: 'tenant-b-pass',
    });

    expect(ownerLogin).not.toBeNull();
    expect(financeLogin).not.toBeNull();
    expect(tenantBLogin).not.toBeNull();

    const ownerClient = createClient(ownerLogin!.accessToken);
    const financeClient = createClient(financeLogin!.accessToken);
    const tenantBClient = createClient(tenantBLogin!.accessToken);
    const order = await createInvoiceOrder(ownerClient, 'tenant-a');
    const suffix = uniqueSuffix();

    const issued = await ownerClient.invoice.issue.mutate({
      orderId: order.id,
      number: `INV-CASHFLOW-${suffix}`,
      currency: 'CZK',
      amountNet: 4200,
      vatRatePercent: 21,
      dueAt: new Date('2026-05-15').toISOString(),
    });

    await ownerClient.invoice.paid.mutate({
      invoiceId: issued.id,
      paidAt: new Date('2026-05-16').toISOString(),
      version: issued.version,
    });

    const tenantACashflow = await financeClient.cashflow.list.query();

    expect(tenantACashflow.every((item) => item.tenantId === 'tenant-a')).toBe(true);

    const tenantAForInvoice = tenantACashflow.filter(
      (item) => item.invoiceId === issued.id,
    );

    expect(tenantAForInvoice.map((item) => item.kind).sort()).toEqual([
      'ACTUAL_IN',
      'PLANNED_IN',
    ]);

    const tenantBCashflow = await tenantBClient.cashflow.list.query();
    expect(tenantBCashflow.some((item) => item.invoiceId === issued.id)).toBe(false);
  });
});
