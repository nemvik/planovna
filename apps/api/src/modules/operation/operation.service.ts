import { Injectable } from '@nestjs/common';
import { assertVersion } from '../../common/optimistic-lock/assert-version';
import { PrismaService } from '../../prisma/prisma.service';
import { BoardAuditService } from './board-audit.service';
import {
  CreateOperationDependencyDto,
  CreateOperationDto,
  RemoveOperationDependencyDto,
  UpdateOperationDto,
} from './dto/operation.dto';

export class OperationDependencyValidationError extends Error {
  constructor(
    readonly code:
      | 'DEPENDENCY_SELF_REFERENCE'
      | 'DEPENDENCY_DUPLICATE'
      | 'DEPENDENCY_CYCLE'
      | 'DEPENDENCY_INVALID_TARGET'
      | 'DEPENDENCY_NOT_FOUND',
    message: string,
  ) {
    super(message);
  }
}

type OperationRecord = CreateOperationDto & {
  id: string;
  version: number;
  dependencyCount: number;
  prerequisiteCodes: string[];
  prerequisiteOverflowCount: number;
};

const BOARD_PREREQUISITE_CODE_LIMIT = 3;

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
  _count: {
    dependsOn: number;
  };
  dependsOn: Array<{
    dependsOn: {
      code: string;
    };
  }>;
};

@Injectable()
export class OperationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardAuditService: BoardAuditService,
  ) {}

  async create(input: CreateOperationDto & { actorUserId?: string }) {
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
      select: this.operationSelect(input.tenantId),
    });

    await this.boardAuditService.append({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      entityType: 'operation',
      entityId: created.id,
      action: 'create',
      summary: `Created operation ${created.code} — ${created.title}`,
    });

    return this.toOperationRecord(created);
  }

  async list(tenantId: string) {
    const operations = await this.prisma.operation.findMany({
      where: { tenantId },
      orderBy: [{ sortIndex: 'asc' }, { createdAt: 'asc' }],
      select: this.operationSelect(tenantId),
    });

    return operations.map((operation) => this.toOperationRecord(operation));
  }

  async listAudit(tenantId: string) {
    return this.boardAuditService.list(tenantId);
  }

  async update(input: UpdateOperationDto & { actorUserId?: string }) {
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

    const before = await this.prisma.operation.findUnique({
      where: { id: input.id },
      select: {
        code: true,
        title: true,
        status: true,
        startDate: true,
        sortIndex: true,
      },
    });

    const {
      id: _ignoredId,
      tenantId: _ignoredTenantId,
      version: _ignoredVersion,
      actorUserId: _ignoredActorUserId,
      ...patch
    } = input;
    const updateData = {
      ...patch,
      ...('startDate' in input ? { startDate: input.startDate } : {}),
      ...('blockedReason' in input ? { blockedReason: input.blockedReason } : {}),
      ...('endDate' in input ? { endDate: input.endDate } : {}),
      version: {
        increment: 1,
      },
    };

    const updated = await this.prisma.operation.updateMany({
      where: {
        id: existing.id,
        tenantId: existing.tenantId,
        version: existing.version,
      },
      data: updateData,
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
      select: this.operationSelect(existing.tenantId),
    });

    if (!row) {
      return null;
    }

    const summaries: string[] = [];
    if (before) {
      if (before.status !== row.status) {
        summaries.push(`status ${before.status} → ${row.status}`);
      }
      const beforeStart = before.startDate?.toISOString().slice(0, 10) ?? 'Backlog';
      const afterStart = row.startDate?.toISOString().slice(0, 10) ?? 'Backlog';
      if (beforeStart !== afterStart) {
        summaries.push(`bucket ${beforeStart} → ${afterStart}`);
      }
      if (before.sortIndex !== row.sortIndex) {
        summaries.push(`sort ${before.sortIndex} → ${row.sortIndex}`);
      }
      if (before.title !== row.title) {
        summaries.push(`title updated to ${row.title}`);
      }
    }

    if (summaries.length > 0) {
      await this.boardAuditService.append({
        tenantId: row.tenantId,
        actorUserId: input.actorUserId,
        entityType: 'operation',
        entityId: row.id,
        action: 'update',
        summary: `${row.code}: ${summaries.join(', ')}`,
      });
    }

    return this.toOperationRecord(row);
  }

  async addDependency(
    tenantId: string,
    input: CreateOperationDependencyDto & { actorUserId?: string },
  ) {
    if (input.operationId === input.dependsOnId) {
      throw new OperationDependencyValidationError(
        'DEPENDENCY_SELF_REFERENCE',
        'Operation cannot depend on itself',
      );
    }

    const [operation, target, duplicate] = await Promise.all([
      this.prisma.operation.findUnique({
        where: { id: input.operationId },
        select: { id: true, tenantId: true, code: true },
      }),
      this.prisma.operation.findUnique({
        where: { id: input.dependsOnId },
        select: { id: true, tenantId: true, code: true },
      }),
      this.prisma.operationDependency.findUnique({
        where: {
          tenantId_operationId_dependsOnId: {
            tenantId,
            operationId: input.operationId,
            dependsOnId: input.dependsOnId,
          },
        },
        select: { id: true },
      }),
    ]);

    if (
      !operation ||
      !target ||
      operation.tenantId !== tenantId ||
      target.tenantId !== tenantId
    ) {
      throw new OperationDependencyValidationError(
        'DEPENDENCY_INVALID_TARGET',
        'Dependency target not found in tenant scope',
      );
    }

    if (duplicate) {
      throw new OperationDependencyValidationError(
        'DEPENDENCY_DUPLICATE',
        'Dependency already exists',
      );
    }

    const createsCycle = await this.detectDependencyPath(
      tenantId,
      input.dependsOnId,
      input.operationId,
    );

    if (createsCycle) {
      throw new OperationDependencyValidationError(
        'DEPENDENCY_CYCLE',
        'Dependency would create a cycle',
      );
    }

    await this.prisma.operationDependency.create({
      data: {
        tenantId,
        operationId: input.operationId,
        dependsOnId: input.dependsOnId,
      },
    });

    const row = await this.prisma.operation.findUnique({
      where: { id: input.operationId },
      select: this.operationSelect(tenantId),
    });

    if (row) {
      await this.boardAuditService.append({
        tenantId,
        actorUserId: input.actorUserId,
        entityType: 'operation',
        entityId: row.id,
        action: 'dependency_add',
        summary: `${row.code}: added dependency on ${target.code}`,
      });
    }

    return row ? this.toOperationRecord(row) : null;
  }

  async removeDependency(
    tenantId: string,
    input: RemoveOperationDependencyDto & { actorUserId?: string },
  ) {
    const [dependency, operation, target] = await Promise.all([
      this.prisma.operationDependency.findUnique({
        where: {
          tenantId_operationId_dependsOnId: {
            tenantId,
            operationId: input.operationId,
            dependsOnId: input.dependsOnId,
          },
        },
        select: { id: true },
      }),
      this.prisma.operation.findUnique({
        where: { id: input.operationId },
        select: { code: true },
      }),
      this.prisma.operation.findUnique({
        where: { id: input.dependsOnId },
        select: { code: true },
      }),
    ]);

    if (!dependency) {
      throw new OperationDependencyValidationError(
        'DEPENDENCY_NOT_FOUND',
        'Dependency not found',
      );
    }

    await this.prisma.operationDependency.delete({
      where: { id: dependency.id },
    });

    const row = await this.prisma.operation.findUnique({
      where: { id: input.operationId },
      select: this.operationSelect(tenantId),
    });

    if (row) {
      await this.boardAuditService.append({
        tenantId,
        actorUserId: input.actorUserId,
        entityType: 'operation',
        entityId: row.id,
        action: 'dependency_remove',
        summary: `${operation?.code ?? row.code}: removed dependency on ${target?.code ?? input.dependsOnId}`,
      });
    }

    return row ? this.toOperationRecord(row) : null;
  }

  private async detectDependencyPath(tenantId: string, startId: string, targetId: string) {
    const visited = new Set<string>();
    const queue = [startId];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) {
        continue;
      }
      if (current === targetId) {
        return true;
      }
      visited.add(current);

      const edges = await this.prisma.operationDependency.findMany({
        where: {
          tenantId,
          operationId: current,
        },
        select: { dependsOnId: true },
      });

      for (const edge of edges) {
        if (!visited.has(edge.dependsOnId)) {
          queue.push(edge.dependsOnId);
        }
      }
    }

    return false;
  }

  private operationSelect(tenantId: string) {
    return {
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
      _count: {
        select: {
          dependsOn: {
            where: {
              tenantId,
              dependsOn: {
                tenantId,
              },
            },
          },
        },
      },
      dependsOn: {
        where: {
          tenantId,
          dependsOn: {
            tenantId,
          },
        },
        orderBy: {
          dependsOn: {
            code: 'asc' as const,
          },
        },
        take: BOARD_PREREQUISITE_CODE_LIMIT,
        select: {
          dependsOn: {
            select: {
              code: true,
            },
          },
        },
      },
    };
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
      dependencyCount: row._count.dependsOn,
      prerequisiteCodes: row.dependsOn.map((dependency) => dependency.dependsOn.code),
      prerequisiteOverflowCount: Math.max(0, row._count.dependsOn - row.dependsOn.length),
    };
  }
}
