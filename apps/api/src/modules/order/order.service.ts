import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { assertVersion } from '../../common/optimistic-lock/assert-version';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto, UpdateOrderDto } from './dto/order.dto';

type OrderRecord = CreateOrderDto & { id: string; version: number };

type PrismaOrderRow = {
  id: string;
  tenantId: string;
  customerId: string;
  code: string;
  title: string;
  status: string;
  dueDate: Date | null;
  notes: string | null;
  version: number;
};

@Injectable()
export class OrderService {
  private readonly db = new Map<string, OrderRecord>();

  constructor(private readonly prisma?: PrismaService) {}

  async create(input: CreateOrderDto) {
    if (!this.prisma) {
      const id = randomUUID();
      const row: OrderRecord = { ...input, id, version: 1 };
      this.db.set(id, row);
      return row;
    }

    const created = await this.prisma.order.create({
      data: {
        tenantId: input.tenantId,
        customerId: input.customerId,
        code: input.code,
        title: input.title,
        status: input.status,
        dueDate: input.dueDate,
        notes: input.notes,
      },
      select: {
        id: true,
        tenantId: true,
        customerId: true,
        code: true,
        title: true,
        status: true,
        dueDate: true,
        notes: true,
        version: true,
      },
    });

    const row = this.toOrderRecord(created);
    this.db.set(row.id, row);
    return row;
  }

  async list(tenantId: string) {
    if (!this.prisma) {
      return Array.from(this.db.values()).filter((x) => x.tenantId === tenantId);
    }

    const orders = await this.prisma.order.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        tenantId: true,
        customerId: true,
        code: true,
        title: true,
        status: true,
        dueDate: true,
        notes: true,
        version: true,
      },
    });

    return orders.map((order) => this.toOrderRecord(order));
  }

  async update(input: UpdateOrderDto) {
    if (!this.prisma) {
      const row = this.db.get(input.id);
      if (!row || row.tenantId !== input.tenantId) return null;

      assertVersion('Order', row.id, input.version, row.version);

      const { tenantId: _ignoredTenantId, ...patch } = input;
      const next = { ...row, ...patch, tenantId: row.tenantId, version: row.version + 1 };
      this.db.set(row.id, next);
      return next;
    }

    const existing = await this.prisma.order.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        tenantId: true,
        version: true,
      },
    });

    if (!existing || existing.tenantId !== input.tenantId) {
      return null;
    }

    assertVersion('Order', existing.id, input.version, existing.version);

    const {
      id: _ignoredId,
      tenantId: _ignoredTenantId,
      version: _ignoredVersion,
      ...patch
    } = input;

    const updated = await this.prisma.order.updateMany({
      where: {
        id: existing.id,
        tenantId: existing.tenantId,
        version: existing.version,
      },
      data: {
        ...patch,
        version: {
          increment: 1,
        },
      },
    });

    if (updated.count === 0) {
      const latest = await this.prisma.order.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          tenantId: true,
          version: true,
        },
      });

      if (!latest || latest.tenantId !== input.tenantId) {
        return null;
      }

      assertVersion('Order', latest.id, input.version, latest.version);
    }

    const row = await this.prisma.order.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        tenantId: true,
        customerId: true,
        code: true,
        title: true,
        status: true,
        dueDate: true,
        notes: true,
        version: true,
      },
    });

    if (!row) {
      return null;
    }

    return this.toOrderRecord(row);
  }

  private toOrderRecord(row: PrismaOrderRow): OrderRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      customerId: row.customerId,
      code: row.code,
      title: row.title,
      status: row.status,
      dueDate: row.dueDate?.toISOString(),
      notes: row.notes ?? undefined,
      version: row.version,
    };
  }
}
