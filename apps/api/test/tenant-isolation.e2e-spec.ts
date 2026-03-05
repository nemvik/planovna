import { CashflowService } from '../src/modules/cashflow/cashflow.service';
import { CustomerService } from '../src/modules/customer/customer.service';
import { InvoiceService } from '../src/modules/invoice/invoice.service';
import { OperationService } from '../src/modules/operation/operation.service';
import { OrderService } from '../src/modules/order/order.service';

describe('Tenant isolation mutations', () => {
  it('prevents cross-tenant customer update', () => {
    const customers = new CustomerService();
    const customerA = customers.create({
      tenantId: 'tenant-a',
      name: 'A Corp',
    });

    const result = customers.update({
      id: customerA.id,
      tenantId: 'tenant-b',
      version: customerA.version,
      name: 'Hacked Name',
    });

    expect(result).toBeNull();
    const tenantAList = customers.list('tenant-a');
    expect(tenantAList[0].name).toBe('A Corp');
  });

  it('prevents cross-tenant order and operation update', () => {
    const orders = new OrderService();
    const operations = new OperationService();

    const orderA = orders.create({
      tenantId: 'tenant-a',
      customerId: 'c-1',
      code: 'ORD-1',
      title: 'Order A',
      status: 'OPEN',
    });

    const operationA = operations.create({
      tenantId: 'tenant-a',
      orderId: orderA.id,
      code: 'OP-1',
      title: 'Operation A',
      status: 'READY',
      sortIndex: 0,
    });

    const orderResult = orders.update({
      id: orderA.id,
      tenantId: 'tenant-b',
      version: orderA.version,
      title: 'Mutated by B',
    });

    const opResult = operations.update({
      id: operationA.id,
      tenantId: 'tenant-b',
      version: operationA.version,
      title: 'Mutated by B',
    });

    expect(orderResult).toBeNull();
    expect(opResult).toBeNull();

    expect(orders.list('tenant-a')[0].title).toBe('Order A');
    expect(operations.list('tenant-a')[0].title).toBe('Operation A');
  });

  it('prevents cross-tenant invoice markPaid and side effects', () => {
    const cashflow = new CashflowService();
    const invoices = new InvoiceService(cashflow);

    const invoiceA = invoices.issue({
      tenantId: 'tenant-a',
      orderId: 'order-a',
      number: '2026-0001',
      currency: 'CZK',
      amountGross: 1234,
      dueAt: new Date('2026-03-31').toISOString(),
    });

    const markPaidResult = invoices.markPaid('tenant-b', {
      invoiceId: invoiceA.id,
      paidAt: new Date('2026-04-01').toISOString(),
      version: invoiceA.version,
      tenantId: 'tenant-a',
    });

    expect(markPaidResult).toBeNull();

    const aItems = cashflow.list('tenant-a');
    const bItems = cashflow.list('tenant-b');

    expect(aItems.filter((x) => x.kind === 'PLANNED_IN')).toHaveLength(1);
    expect(aItems.filter((x) => x.kind === 'ACTUAL_IN')).toHaveLength(0);
    expect(bItems).toHaveLength(0);
  });

  it('keeps same-tenant invoice -> cashflow behavior green', () => {
    const cashflow = new CashflowService();
    const invoices = new InvoiceService(cashflow);

    const invoiceA = invoices.issue({
      tenantId: 'tenant-a',
      orderId: 'order-a',
      number: '2026-0002',
      currency: 'CZK',
      amountGross: 2000,
      dueAt: new Date('2026-03-31').toISOString(),
    });

    const paid = invoices.markPaid('tenant-a', {
      invoiceId: invoiceA.id,
      paidAt: new Date('2026-04-01').toISOString(),
      version: invoiceA.version,
    });

    expect(paid?.status).toBe('PAID');
    const aItems = cashflow.list('tenant-a');
    expect(aItems.filter((x) => x.kind === 'PLANNED_IN')).toHaveLength(1);
    expect(aItems.filter((x) => x.kind === 'ACTUAL_IN')).toHaveLength(1);
  });
});
