import { Injectable } from '@nestjs/common';
import { assertVersion } from '../../common/optimistic-lock/assert-version';
import { PrismaService } from '../../prisma/prisma.service';
import { CashflowService } from '../cashflow/cashflow.service';
import { CreateInvoiceDto, MarkPaidDto } from './dto/invoice.dto';

type Invoice = CreateInvoiceDto & {
  id: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID';
  paidAt?: string;
  version: number;
};

type PrismaInvoiceRow = {
  id: string;
  tenantId: string;
  orderId: string;
  number: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID';
  currency: string;
  amountGross: {
    toNumber(): number;
  };
  issuedAt: Date | null;
  dueAt: Date | null;
  paidAt: Date | null;
  version: number;
};

@Injectable()
export class InvoiceService {
  constructor(
    private readonly cashflow: CashflowService,
    private readonly prisma: PrismaService,
  ) {}

  async list(actorTenantId: string) {
    const persisted = await this.prisma.invoice.findMany({
      where: { tenantId: actorTenantId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        tenantId: true,
        orderId: true,
        number: true,
        status: true,
        currency: true,
        amountGross: true,
        issuedAt: true,
        dueAt: true,
        paidAt: true,
        version: true,
      },
    });

    return persisted.map((invoice) => this.toInvoiceRecord(invoice));
  }

  async issue(actorTenantId: string, input: CreateInvoiceDto) {
    const created = await this.prisma.invoice.create({
      data: {
        tenantId: actorTenantId,
        orderId: input.orderId,
        number: input.number,
        status: 'ISSUED',
        currency: input.currency,
        amountNet: 0,
        amountVat: 0,
        amountGross: input.amountGross,
        issuedAt: input.issuedAt,
        dueAt: input.dueAt,
      },
      select: {
        id: true,
        tenantId: true,
        orderId: true,
        number: true,
        status: true,
        currency: true,
        amountGross: true,
        issuedAt: true,
        dueAt: true,
        paidAt: true,
        version: true,
      },
    });

    const row = this.toInvoiceRecord(created);

    await this.cashflow.upsertPlannedIn({
      tenantId: row.tenantId,
      invoiceId: row.id,
      amount: row.amountGross,
      currency: row.currency,
      date: row.dueAt ?? row.issuedAt ?? new Date().toISOString(),
    });

    return row;
  }

  async markPaid(actorTenantId: string, input: MarkPaidDto) {
    const existing = await this.prisma.invoice.findUnique({
      where: { id: input.invoiceId },
      select: {
        id: true,
        tenantId: true,
        version: true,
      },
    });

    if (!existing || existing.tenantId !== actorTenantId) {
      return null;
    }

    assertVersion('Invoice', existing.id, input.version, existing.version);

    const updated = await this.prisma.invoice.updateMany({
      where: {
        id: existing.id,
        tenantId: existing.tenantId,
        version: existing.version,
      },
      data: {
        status: 'PAID',
        paidAt: input.paidAt,
        version: {
          increment: 1,
        },
      },
    });

    if (updated.count === 0) {
      const latest = await this.prisma.invoice.findUnique({
        where: { id: input.invoiceId },
        select: {
          id: true,
          tenantId: true,
          version: true,
        },
      });

      if (!latest || latest.tenantId !== actorTenantId) {
        return null;
      }

      assertVersion('Invoice', latest.id, input.version, latest.version);
    }

    const row = await this.prisma.invoice.findUnique({
      where: { id: input.invoiceId },
      select: {
        id: true,
        tenantId: true,
        orderId: true,
        number: true,
        status: true,
        currency: true,
        amountGross: true,
        issuedAt: true,
        dueAt: true,
        paidAt: true,
        version: true,
      },
    });

    if (!row) {
      return null;
    }

    const next = this.toInvoiceRecord(row);

    await this.cashflow.upsertActualIn({
      tenantId: next.tenantId,
      invoiceId: next.id,
      amount: next.amountGross,
      currency: next.currency,
      date: next.paidAt ?? input.paidAt,
    });

    return next;
  }

  private toInvoiceRecord(row: PrismaInvoiceRow): Invoice {
    return {
      id: row.id,
      tenantId: row.tenantId,
      orderId: row.orderId,
      number: row.number,
      status: row.status,
      currency: row.currency as 'CZK' | 'EUR',
      amountGross: row.amountGross.toNumber(),
      issuedAt: row.issuedAt?.toISOString(),
      dueAt: row.dueAt?.toISOString(),
      paidAt: row.paidAt?.toISOString(),
      version: row.version,
    };
  }
}
