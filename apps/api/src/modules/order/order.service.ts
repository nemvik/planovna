import { Injectable } from '@nestjs/common';
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

const orderRecordSelect = {
  id: true,
  tenantId: true,
  customerId: true,
  code: true,
  title: true,
  status: true,
  dueDate: true,
  notes: true,
  version: true,
} as const;

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateOrderDto) {
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
      select: orderRecordSelect,
    });

    return this.toOrderRecord(created);
  }

  async list(tenantId: string) {
    const orders = await this.prisma.order.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: orderRecordSelect,
    });

    return orders.map((order) => this.toOrderRecord(order));
  }

  async update(input: UpdateOrderDto) {
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
      select: orderRecordSelect,
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
