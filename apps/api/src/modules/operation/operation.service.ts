import { Injectable } from '@nestjs/common';
import { assertVersion } from '../../common/optimistic-lock/assert-version';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOperationDto, UpdateOperationDto } from './dto/operation.dto';

type OperationRecord = CreateOperationDto & { id: string; version: number };

type PrismaOperationRow = {
  id: string;
  tenantId: string;
  orderId: string;
  code: string;
  title: string;
  status: 'READY' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';
  startDate: Date | null;
  endDate: Date | null;
  sortIndex: number;
  blockedReason: string | null;
  version: number;
};

@Injectable()
export class OperationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateOperationDto) {
    const created = await this.prisma.operation.create({
      data: {
        tenantId: input.tenantId,
        orderId: input.orderId,
        code: input.code,
        title: input.title,
        status: input.status,
        startDate: input.startDate,
        endDate: input.endDate,
        sortIndex: input.sortIndex,
        blockedReason: input.blockedReason,
      },
      select: {
        id: true,
        tenantId: true,
        orderId: true,
        code: true,
        title: true,
        status: true,
        startDate: true,
        endDate: true,
        sortIndex: true,
        blockedReason: true,
        version: true,
      },
    });

    return this.toOperationRecord(created);
  }

  async list(tenantId: string) {
    const operations = await this.prisma.operation.findMany({
      where: { tenantId },
      orderBy: [{ sortIndex: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        tenantId: true,
        orderId: true,
        code: true,
        title: true,
        status: true,
        startDate: true,
        endDate: true,
        sortIndex: true,
        blockedReason: true,
        version: true,
      },
    });

    return operations.map((operation) => this.toOperationRecord(operation));
  }

  async update(input: UpdateOperationDto) {
    const existing = await this.prisma.operation.findUnique({
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

    assertVersion('Operation', existing.id, input.version, existing.version);

    const {
      id: _ignoredId,
      tenantId: _ignoredTenantId,
      version: _ignoredVersion,
      ...patch
    } = input;

    const updated = await this.prisma.operation.updateMany({
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
      const latest = await this.prisma.operation.findUnique({
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

      assertVersion('Operation', latest.id, input.version, latest.version);
    }

    const row = await this.prisma.operation.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        tenantId: true,
        orderId: true,
        code: true,
        title: true,
        status: true,
        startDate: true,
        endDate: true,
        sortIndex: true,
        blockedReason: true,
        version: true,
      },
    });

    if (!row) {
      return null;
    }

    return this.toOperationRecord(row);
  }

  private toOperationRecord(row: PrismaOperationRow): OperationRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      orderId: row.orderId,
      code: row.code,
      title: row.title,
      status: row.status,
      startDate: row.startDate?.toISOString(),
      endDate: row.endDate?.toISOString(),
      sortIndex: row.sortIndex,
      blockedReason: row.blockedReason ?? undefined,
      version: row.version,
    };
  }
}
