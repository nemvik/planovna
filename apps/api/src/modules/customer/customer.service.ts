import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { assertVersion } from '../../common/optimistic-lock/assert-version';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

type CustomerRecord = CreateCustomerDto & { id: string; version: number };

@Injectable()
export class CustomerService {
  private readonly db = new Map<string, CustomerRecord>();

  create(input: CreateCustomerDto) {
    const id = randomUUID();
    const row: CustomerRecord = { ...input, id, version: 1 };
    this.db.set(id, row);
    return row;
  }

  list(tenantId: string) {
    return Array.from(this.db.values()).filter((x) => x.tenantId === tenantId);
  }

  update(input: UpdateCustomerDto) {
    const row = this.db.get(input.id);
    if (!row || row.tenantId !== input.tenantId) return null;

    assertVersion('Customer', row.id, input.version, row.version);

    const next = { ...row, ...input, version: row.version + 1 };
    this.db.set(row.id, next);
    return next;
  }
}
