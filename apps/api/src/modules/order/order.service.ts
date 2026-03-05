import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { assertVersion } from '../../common/optimistic-lock/assert-version';
import { CreateOrderDto, UpdateOrderDto } from './dto/order.dto';

type OrderRecord = CreateOrderDto & { id: string; version: number };

@Injectable()
export class OrderService {
  private readonly db = new Map<string, OrderRecord>();

  create(input: CreateOrderDto) {
    const id = randomUUID();
    const row: OrderRecord = { ...input, id, version: 1 };
    this.db.set(id, row);
    return row;
  }

  list(tenantId: string) {
    return Array.from(this.db.values()).filter((x) => x.tenantId === tenantId);
  }

  update(input: UpdateOrderDto) {
    const row = this.db.get(input.id);
    if (!row || row.tenantId !== input.tenantId) return null;

    assertVersion('Order', row.id, input.version, row.version);

    const { tenantId: _ignoredTenantId, ...patch } = input;
    const next = { ...row, ...patch, tenantId: row.tenantId, version: row.version + 1 };
    this.db.set(row.id, next);
    return next;
  }
}
