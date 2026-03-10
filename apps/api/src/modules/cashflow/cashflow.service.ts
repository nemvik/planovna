import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

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

type CashflowInput = Omit<CashflowItem, 'id' | 'kind'>;

type PrismaCashflowRow = {
  id: string;
  tenantId: string;
  invoiceId: string | null;
  kind: string;
  amount: {
    toNumber(): number;
  };
  currency: string;
  date: Date;
};

@Injectable()
export class CashflowService {
  private readonly db = new Map<string, CashflowItem>();

  constructor(private readonly prisma?: PrismaService) {}

  async upsertPlannedIn(input: CashflowInput) {
    return this.upsertByKind('PLANNED_IN', input);
  }

  async upsertActualIn(input: CashflowInput) {
    return this.upsertByKind('ACTUAL_IN', input);
  }

  async list(tenantId: string) {
    if (!this.prisma) {
      return Array.from(this.db.values()).filter((x) => x.tenantId === tenantId);
    }

    const items = await this.prisma.cashflowItem.findMany({
      where: { tenantId },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        tenantId: true,
        invoiceId: true,
        kind: true,
        amount: true,
        currency: true,
        date: true,
      },
    });

    return items.flatMap((item) => {
      const row = this.toCashflowItem(item);
      return row ? [row] : [];
    });
  }

  private async upsertByKind(kind: CashflowKind, input: CashflowInput) {
    if (!this.prisma) {
      const existing = Array.from(this.db.values()).find(
        (x) => x.invoiceId === input.invoiceId && x.tenantId === input.tenantId && x.kind === kind,
      );
      if (existing) {
        const next = { ...existing, ...input };
        this.db.set(existing.id, next);
        return next;
      }
      const row: CashflowItem = { id: randomUUID(), kind, ...input };
      this.db.set(row.id, row);
      return row;
    }

    const existing = await this.prisma.cashflowItem.findFirst({
      where: {
        tenantId: input.tenantId,
        invoiceId: input.invoiceId,
        kind,
      },
      select: {
        id: true,
      },
    });

    const row = existing
      ? await this.prisma.cashflowItem.update({
          where: { id: existing.id },
          data: {
            amount: input.amount,
            currency: input.currency,
            date: input.date,
          },
          select: {
            id: true,
            tenantId: true,
            invoiceId: true,
            kind: true,
            amount: true,
            currency: true,
            date: true,
          },
        })
      : await this.prisma.cashflowItem.create({
          data: {
            tenantId: input.tenantId,
            invoiceId: input.invoiceId,
            kind,
            amount: input.amount,
            currency: input.currency,
            date: input.date,
          },
          select: {
            id: true,
            tenantId: true,
            invoiceId: true,
            kind: true,
            amount: true,
            currency: true,
            date: true,
          },
        });

    return this.toCashflowItemOrThrow(row);
  }

  private toCashflowItemOrThrow(row: PrismaCashflowRow): CashflowItem {
    const item = this.toCashflowItem(row);
    if (!item) {
      throw new Error(`Cashflow item ${row.id} is missing invoiceId`);
    }
    return item;
  }

  private toCashflowItem(row: PrismaCashflowRow): CashflowItem | null {
    if (!row.invoiceId || !this.isCashflowKind(row.kind)) {
      return null;
    }

    return {
      id: row.id,
      tenantId: row.tenantId,
      invoiceId: row.invoiceId,
      kind: row.kind,
      amount: row.amount.toNumber(),
      currency: row.currency as 'CZK' | 'EUR',
      date: row.date.toISOString(),
    };
  }

  private isCashflowKind(kind: string): kind is CashflowKind {
    return kind === 'PLANNED_IN' || kind === 'ACTUAL_IN';
  }
}
