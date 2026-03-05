import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export type CashflowKind = 'PLANNED_IN' | 'ACTUAL_IN';
export type CashflowItem = {
  id: string;
  tenantId: string;
  invoiceId: string;
  kind: CashflowKind;
  amount: number;
  currency: 'CZK' | 'EUR';
  date: string;
};

@Injectable()
export class CashflowService {
  private readonly db = new Map<string, CashflowItem>();

  upsertPlannedIn(input: Omit<CashflowItem, 'id' | 'kind'>) {
    const existing = Array.from(this.db.values()).find((x) => x.invoiceId === input.invoiceId && x.kind === 'PLANNED_IN');
    if (existing) {
      const next = { ...existing, ...input };
      this.db.set(existing.id, next);
      return next;
    }
    const row: CashflowItem = { id: randomUUID(), kind: 'PLANNED_IN', ...input };
    this.db.set(row.id, row);
    return row;
  }

  upsertActualIn(input: Omit<CashflowItem, 'id' | 'kind'>) {
    const existing = Array.from(this.db.values()).find((x) => x.invoiceId === input.invoiceId && x.kind === 'ACTUAL_IN');
    if (existing) {
      const next = { ...existing, ...input };
      this.db.set(existing.id, next);
      return next;
    }
    const row: CashflowItem = { id: randomUUID(), kind: 'ACTUAL_IN', ...input };
    this.db.set(row.id, row);
    return row;
  }

  list(tenantId: string) {
    return Array.from(this.db.values()).filter((x) => x.tenantId === tenantId);
  }
}
