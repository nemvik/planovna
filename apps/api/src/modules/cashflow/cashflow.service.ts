import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateRecurringCashflowRuleDto,
  RecurringCashflowRuleActionDto,
  UpdateRecurringCashflowRuleDto,
} from './dto/recurring-cashflow.dto';

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

export type RecurringCashflowRule = {
  id: string;
  tenantId: string;
  label: string;
  amount: number;
  currency: 'CZK' | 'EUR';
  interval: 'MONTHLY';
  startDate: string;
  nextRunAt: string;
  note?: string;
  status: 'ACTIVE' | 'PAUSED' | 'STOPPED';
  stoppedAt?: string;
  version: number;
};

type CashflowInput = Omit<CashflowItem, 'id' | 'kind'>;

type PrismaCashflowRow = {
  id: string;
  tenantId: string;
  invoiceId: string | null;
  kind: string;
  amount: { toNumber(): number };
  currency: string;
  date: Date;
};

type PrismaRecurringRuleRow = {
  id: string;
  tenantId: string;
  label: string;
  amount: { toNumber(): number };
  currency: string;
  interval: string;
  startDate: Date;
  nextRunAt: Date;
  note: string | null;
  status: string;
  stoppedAt: Date | null;
  version: number;
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

  async listRecurringRules(tenantId: string) {
    if (!this.prisma) {
      return [];
    }

    const rows = await this.prisma.recurringCashflowRule.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: 'asc' }],
    });

    return rows.map((row) => this.toRecurringRule(row));
  }

  async createRecurringRule(tenantId: string, input: CreateRecurringCashflowRuleDto) {
    if (!this.prisma) {
      throw new Error('Recurring cashflow requires Prisma');
    }

    const row = await this.prisma.recurringCashflowRule.create({
      data: {
        tenantId,
        label: input.label,
        amount: input.amount,
        currency: input.currency,
        interval: input.interval,
        startDate: input.startDate,
        nextRunAt: input.startDate,
        note: input.note,
        status: 'ACTIVE',
      },
    });

    return this.toRecurringRule(row);
  }

  async updateRecurringRule(tenantId: string, input: UpdateRecurringCashflowRuleDto) {
    if (!this.prisma) {
      throw new Error('Recurring cashflow requires Prisma');
    }

    const existing = await this.prisma.recurringCashflowRule.findUnique({ where: { id: input.id } });
    if (!existing || existing.tenantId !== tenantId) {
      return null;
    }
    if (existing.version !== input.version) {
      throw new Error('VERSION_CONFLICT');
    }

    const row = await this.prisma.recurringCashflowRule.update({
      where: { id: existing.id },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.startDate !== undefined ? { startDate: input.startDate, nextRunAt: input.startDate } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
        version: { increment: 1 },
      },
    });

    return this.toRecurringRule(row);
  }

  async pauseRecurringRule(tenantId: string, input: RecurringCashflowRuleActionDto) {
    return this.transitionRecurringRule(tenantId, input, 'PAUSED');
  }

  async resumeRecurringRule(tenantId: string, input: RecurringCashflowRuleActionDto) {
    return this.transitionRecurringRule(tenantId, input, 'ACTIVE');
  }

  async stopRecurringRule(tenantId: string, input: RecurringCashflowRuleActionDto) {
    return this.transitionRecurringRule(tenantId, input, 'STOPPED');
  }

  private async transitionRecurringRule(
    tenantId: string,
    input: RecurringCashflowRuleActionDto,
    status: 'ACTIVE' | 'PAUSED' | 'STOPPED',
  ) {
    if (!this.prisma) {
      throw new Error('Recurring cashflow requires Prisma');
    }

    const existing = await this.prisma.recurringCashflowRule.findUnique({ where: { id: input.id } });
    if (!existing || existing.tenantId !== tenantId) {
      return null;
    }
    if (existing.version !== input.version) {
      throw new Error('VERSION_CONFLICT');
    }

    const row = await this.prisma.recurringCashflowRule.update({
      where: { id: existing.id },
      data: {
        status,
        stoppedAt: status === 'STOPPED' ? new Date() : null,
        version: { increment: 1 },
      },
    });

    return this.toRecurringRule(row);
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
      select: { id: true },
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

  private toRecurringRule(row: PrismaRecurringRuleRow): RecurringCashflowRule {
    return {
      id: row.id,
      tenantId: row.tenantId,
      label: row.label,
      amount: row.amount.toNumber(),
      currency: row.currency as 'CZK' | 'EUR',
      interval: 'MONTHLY',
      startDate: row.startDate.toISOString(),
      nextRunAt: row.nextRunAt.toISOString(),
      note: row.note ?? undefined,
      status: row.status as 'ACTIVE' | 'PAUSED' | 'STOPPED',
      stoppedAt: row.stoppedAt?.toISOString(),
      version: row.version,
    };
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
