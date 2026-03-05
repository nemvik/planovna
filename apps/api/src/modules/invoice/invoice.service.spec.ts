import { CashflowService } from '../cashflow/cashflow.service';
import { InvoiceService } from './invoice.service';

describe('InvoiceService', () => {
  it('creates planned cashflow on issue', () => {
    const cashflow = new CashflowService();
    const service = new InvoiceService(cashflow);

    const invoice = service.issue('t1', {
      tenantId: 't1',
      orderId: 'o1',
      number: '2026-0001',
      currency: 'CZK',
      amountGross: 1000,
      dueAt: new Date('2026-03-31').toISOString(),
    });

    const items = cashflow.list('t1');
    expect(invoice.status).toBe('ISSUED');
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('PLANNED_IN');
    expect(items[0].invoiceId).toBe(invoice.id);
  });

  it('creates actual cashflow on markPaid', () => {
    const cashflow = new CashflowService();
    const service = new InvoiceService(cashflow);

    const invoice = service.issue('t1', {
      tenantId: 't1',
      orderId: 'o1',
      number: '2026-0002',
      currency: 'CZK',
      amountGross: 2000,
      dueAt: new Date('2026-03-31').toISOString(),
    });

    const paidAt = new Date('2026-04-01').toISOString();
    const paid = service.markPaid('t1', {
      invoiceId: invoice.id,
      paidAt,
      version: invoice.version,
    });

    const items = cashflow.list('t1');
    expect(paid?.status).toBe('PAID');
    expect(items.filter((x) => x.kind === 'ACTUAL_IN')).toHaveLength(1);
  });
});
