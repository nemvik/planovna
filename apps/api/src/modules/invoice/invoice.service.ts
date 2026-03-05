import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { assertVersion } from '../../common/optimistic-lock/assert-version';
import { CashflowService } from '../cashflow/cashflow.service';
import { CreateInvoiceDto, MarkPaidDto } from './dto/invoice.dto';

type Invoice = CreateInvoiceDto & {
  id: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID';
  paidAt?: string;
  version: number;
};

@Injectable()
export class InvoiceService {
  private readonly db = new Map<string, Invoice>();

  constructor(private readonly cashflow: CashflowService) {}

  issue(actorTenantId: string, input: CreateInvoiceDto) {
    const id = randomUUID();
    const row: Invoice = {
      ...input,
      tenantId: actorTenantId,
      id,
      status: 'ISSUED',
      version: 1,
    };
    this.db.set(id, row);

    this.cashflow.upsertPlannedIn({
      tenantId: row.tenantId,
      invoiceId: id,
      amount: input.amountGross,
      currency: input.currency,
      date: input.dueAt ?? input.issuedAt ?? new Date().toISOString(),
    });

    return row;
  }

  markPaid(actorTenantId: string, input: MarkPaidDto) {
    const row = this.db.get(input.invoiceId);
    if (!row || row.tenantId !== actorTenantId) return null;

    assertVersion('Invoice', row.id, input.version, row.version);

    const next: Invoice = {
      ...row,
      status: 'PAID',
      paidAt: input.paidAt,
      version: row.version + 1,
    };
    this.db.set(row.id, next);

    this.cashflow.upsertActualIn({
      tenantId: row.tenantId,
      invoiceId: row.id,
      amount: row.amountGross,
      currency: row.currency,
      date: input.paidAt,
    });

    return next;
  }
}
