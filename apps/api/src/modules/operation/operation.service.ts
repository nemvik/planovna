import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { assertVersion } from '../../common/optimistic-lock/assert-version';
import { CreateOperationDto, UpdateOperationDto } from './dto/operation.dto';

type OperationRecord = CreateOperationDto & { id: string; version: number };

@Injectable()
export class OperationService {
  private readonly db = new Map<string, OperationRecord>();

  create(input: CreateOperationDto) {
    const id = randomUUID();
    const row: OperationRecord = { ...input, id, version: 1 };
    this.db.set(id, row);
    return row;
  }

  list(tenantId: string) {
    return Array.from(this.db.values()).filter((x) => x.tenantId === tenantId);
  }

  update(input: UpdateOperationDto) {
    const row = this.db.get(input.id);
    if (!row || row.tenantId !== input.tenantId) return null;

    assertVersion('Operation', row.id, input.version, row.version);

    const next = { ...row, ...input, version: row.version + 1 };
    this.db.set(row.id, next);
    return next;
  }
}
