import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { CashflowService } from '../src/modules/cashflow/cashflow.service';
import { CustomerService } from '../src/modules/customer/customer.service';
import { InvoiceService } from '../src/modules/invoice/invoice.service';
import { OperationService } from '../src/modules/operation/operation.service';
import { OrderService } from '../src/modules/order/order.service';

describe('Tenant isolation mutations', () => {
  let app: INestApplication<App>;
  let customers: CustomerService;
  let orders: OrderService;
  let operations: OperationService;
  let cashflow: CashflowService;
  let invoices: InvoiceService;

  const uniqueSuffix = () => randomUUID().slice(0, 8);

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    customers = app.get(CustomerService);
    orders = app.get(OrderService);
    operations = app.get(OperationService);
    cashflow = app.get(CashflowService);
    invoices = app.get(InvoiceService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('prevents cross-tenant customer update', async () => {
    const suffix = uniqueSuffix();
    const customerA = await customers.create({
      tenantId: 'tenant-a',
      name: `A Corp ${suffix}`,
      email: `tenant-a-customer-${suffix}@example.test`,
    });

    const result = await customers.update({
      id: customerA.id,
      tenantId: 'tenant-b',
      version: customerA.version,
      name: `Hacked Name ${suffix}`,
    });

    expect(result).toBeNull();

    const tenantAList = await customers.list('tenant-a');
    const storedCustomer = tenantAList.find((customer) => customer.id === customerA.id);

    expect(storedCustomer?.name).toBe(`A Corp ${suffix}`);
  });

  it('prevents cross-tenant order and operation update', async () => {
    const suffix = uniqueSuffix();
    const customerA = await customers.create({
      tenantId: 'tenant-a',
      name: `Ops customer ${suffix}`,
      email: `ops-customer-${suffix}@example.test`,
    });
    const orderA = await orders.create({
      tenantId: 'tenant-a',
      customerId: customerA.id,
      code: `ORD-${suffix}`,
      title: `Order A ${suffix}`,
      status: 'OPEN',
    });
    const operationA = await operations.create({
      tenantId: 'tenant-a',
      orderId: orderA.id,
      code: `OP-${suffix}`,
      title: `Operation A ${suffix}`,
      status: 'READY',
      sortIndex: 0,
    });

    const orderResult = await orders.update({
      id: orderA.id,
      tenantId: 'tenant-b',
      version: orderA.version,
      title: `Mutated by B ${suffix}`,
    });
    const opResult = await operations.update({
      id: operationA.id,
      tenantId: 'tenant-b',
      version: operationA.version,
      title: `Mutated by B ${suffix}`,
    });

    expect(orderResult).toBeNull();
    expect(opResult).toBeNull();

    const storedOrder = (await orders.list('tenant-a')).find((order) => order.id === orderA.id);
    const storedOperation = (await operations.list('tenant-a')).find(
      (operation) => operation.id === operationA.id,
    );

    expect(storedOrder?.title).toBe(`Order A ${suffix}`);
    expect(storedOperation?.title).toBe(`Operation A ${suffix}`);
  });

  it('prevents cross-tenant invoice markPaid and side effects', async () => {
    const suffix = uniqueSuffix();
    const customer = await customers.create({
      tenantId: 'tenant-a',
      name: `Invoice customer ${suffix}`,
      email: `invoice-customer-${suffix}@example.test`,
    });
    const order = await orders.create({
      tenantId: 'tenant-a',
      customerId: customer.id,
      code: `INV-ISO-${suffix}`,
      title: `Invoice isolation order ${suffix}`,
      status: 'OPEN',
    });

    const invoiceA = await invoices.issue('tenant-a', {
      tenantId: 'tenant-a',
      orderId: order.id,
      number: `2026-${suffix}`,
      currency: 'CZK',
      amountGross: 1234,
      dueAt: new Date('2026-03-31').toISOString(),
    });

    const markPaidResult = await invoices.markPaid('tenant-b', {
      invoiceId: invoiceA.id,
      paidAt: new Date('2026-04-01').toISOString(),
      version: invoiceA.version,
      tenantId: 'tenant-a',
    });

    expect(markPaidResult).toBeNull();

    const aItems = await cashflow.list('tenant-a');
    const bItems = await cashflow.list('tenant-b');

    expect(aItems.filter((x) => x.invoiceId === invoiceA.id)).toEqual([
      expect.objectContaining({
        tenantId: 'tenant-a',
        invoiceId: invoiceA.id,
        kind: 'PLANNED_IN',
      }),
    ]);
    expect(bItems.some((x) => x.invoiceId === invoiceA.id)).toBe(false);
  });

  it('keeps same-tenant invoice -> cashflow behavior green', async () => {
    const suffix = uniqueSuffix();
    const customer = await customers.create({
      tenantId: 'tenant-a',
      name: `Paid customer ${suffix}`,
      email: `paid-customer-${suffix}@example.test`,
    });
    const order = await orders.create({
      tenantId: 'tenant-a',
      customerId: customer.id,
      code: `INV-PAID-${suffix}`,
      title: `Paid order ${suffix}`,
      status: 'OPEN',
    });

    const invoiceA = await invoices.issue('tenant-a', {
      tenantId: 'tenant-a',
      orderId: order.id,
      number: `2026-paid-${suffix}`,
      currency: 'CZK',
      amountGross: 2000,
      dueAt: new Date('2026-03-31').toISOString(),
    });

    const paid = await invoices.markPaid('tenant-a', {
      invoiceId: invoiceA.id,
      paidAt: new Date('2026-04-01').toISOString(),
      version: invoiceA.version,
    });

    expect(paid?.status).toBe('PAID');

    const aItems = await cashflow.list('tenant-a');
    const invoiceItems = aItems.filter((x) => x.invoiceId === invoiceA.id);

    expect(invoiceItems.map((x) => x.kind).sort()).toEqual([
      'ACTUAL_IN',
      'PLANNED_IN',
    ]);
  });
});
