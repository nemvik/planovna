jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { InvoiceService } from './invoice.service';

describe('InvoiceService', () => {
  const decimal = (value: number) => ({
    toNumber: () => value,
  });

  it('creates planned cashflow on issue', async () => {
    const cashflow = {
      upsertPlannedIn: jest.fn(),
      upsertActualIn: jest.fn(),
    };
    const prisma = {
      invoice: {
        create: jest.fn().mockResolvedValue({
          id: 'inv-1',
          tenantId: 't1',
          orderId: 'o1',
          number: '2026-0001',
          status: 'ISSUED',
          currency: 'CZK',
          amountGross: decimal(1000),
          issuedAt: null,
          dueAt: new Date('2026-03-31T00:00:00.000Z'),
          paidAt: null,
          version: 1,
        }),
      },
    };
    const service = new InvoiceService(cashflow as never, prisma as never);

    const invoice = await service.issue('t1', {
      tenantId: 't1',
      orderId: 'o1',
      number: '2026-0001',
      currency: 'CZK',
      amountGross: 1000,
      dueAt: new Date('2026-03-31').toISOString(),
    });

    expect(invoice).toMatchObject({
      id: 'inv-1',
      tenantId: 't1',
      status: 'ISSUED',
      amountGross: 1000,
      version: 1,
    });
    expect(cashflow.upsertPlannedIn).toHaveBeenCalledWith({
      tenantId: 't1',
      invoiceId: 'inv-1',
      amount: 1000,
      currency: 'CZK',
      date: '2026-03-31T00:00:00.000Z',
    });
    expect(cashflow.upsertActualIn).not.toHaveBeenCalled();
  });

  it('creates actual cashflow on markPaid', async () => {
    const cashflow = {
      upsertPlannedIn: jest.fn(),
      upsertActualIn: jest.fn(),
    };
    const prisma = {
      invoice: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'inv-2',
            tenantId: 't1',
            version: 1,
          })
          .mockResolvedValueOnce({
            id: 'inv-2',
            tenantId: 't1',
            orderId: 'o1',
            number: '2026-0002',
            status: 'PAID',
            currency: 'CZK',
            amountGross: decimal(2000),
            issuedAt: null,
            dueAt: new Date('2026-03-31T00:00:00.000Z'),
            paidAt: new Date('2026-04-01T00:00:00.000Z'),
            version: 2,
          }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new InvoiceService(cashflow as never, prisma as never);

    const paidAt = new Date('2026-04-01').toISOString();
    const paid = await service.markPaid('t1', {
      invoiceId: 'inv-2',
      paidAt,
      version: 1,
    });

    expect(prisma.invoice.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'inv-2',
        tenantId: 't1',
        version: 1,
      },
      data: {
        status: 'PAID',
        paidAt,
        version: {
          increment: 1,
        },
      },
    });
    expect(paid).toMatchObject({
      id: 'inv-2',
      tenantId: 't1',
      status: 'PAID',
      amountGross: 2000,
      version: 2,
      paidAt,
    });
    expect(cashflow.upsertActualIn).toHaveBeenCalledWith({
      tenantId: 't1',
      invoiceId: 'inv-2',
      amount: 2000,
      currency: 'CZK',
      date: paidAt,
    });
    expect(cashflow.upsertPlannedIn).not.toHaveBeenCalled();
  });
});
