import { Injectable } from '@nestjs/common';
import { assertVersion } from '../../common/optimistic-lock/assert-version';
import { PrismaService } from '../../prisma/prisma.service';
import { BoardAuditService } from './board-audit.service';
import {
  BoardColumnConfigItemDto,
  CreateOperationDependencyDto,
  CreateOperationDto,
  RemoveOperationDependencyDto,
  SaveBoardColumnConfigDto,
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

export class BoardColumnConfigValidationError extends Error {
  constructor(
    readonly code:
      | 'BOARD_COLUMN_NAME_REQUIRED'
      | 'BOARD_COLUMN_NAME_DUPLICATE'
      | 'BOARD_COLUMN_KEY_DUPLICATE'
      | 'BOARD_COLUMN_NON_EMPTY_DELETE',
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

type BoardColumnConfigRecord = {
  key: string;
  name: string;
  order: number;
  hidden: boolean;
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

  async listBoardColumns(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { boardColumnConfig: true },
    });

    return this.normalizeBoardColumnConfig(tenant?.boardColumnConfig);
  }

  async saveBoardColumns(tenantId: string, input: SaveBoardColumnConfigDto) {
    const normalizedColumns = this.validateBoardColumnConfig(input.columns);
    const nonEmptyColumns = await this.getNonEmptyBoardColumnKeys(tenantId);

    for (const key of nonEmptyColumns) {
      const nextColumn = normalizedColumns.find((column) => column.key === key);
      if (!nextColumn || nextColumn.hidden) {
        throw new BoardColumnConfigValidationError(
          'BOARD_COLUMN_NON_EMPTY_DELETE',
          'Non-empty columns cannot be hidden or removed.',
        );
      }
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        boardColumnConfig: normalizedColumns,
      },
    });

    return normalizedColumns;
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

  private normalizeBoardColumnConfig(value: unknown): BoardColumnConfigRecord[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is Partial<BoardColumnConfigRecord> => !!item && typeof item === 'object')
      .map((item, index) => ({
        key: typeof item.key === 'string' ? item.key : '',
        name: typeof item.name === 'string' ? item.name.trim() : '',
        order: typeof item.order === 'number' && Number.isInteger(item.order) ? item.order : index,
        hidden: typeof item.hidden === 'boolean' ? item.hidden : false,
      }))
      .filter((item) => item.key.length > 0 && item.name.length > 0)
      .sort((left, right) => left.order - right.order || left.key.localeCompare(right.key))
      .map((item, index) => ({ ...item, order: index }));
  }

  private validateBoardColumnConfig(columns: BoardColumnConfigItemDto[]): BoardColumnConfigRecord[] {
    const seenKeys = new Set<string>();
    const seenNames = new Set<string>();

    return columns
      .map((column, index) => ({
        key: column.key.trim(),
        name: column.name.trim(),
        order: index,
        hidden: column.hidden,
      }))
      .map((column) => {
        if (!column.name) {
          throw new BoardColumnConfigValidationError(
            'BOARD_COLUMN_NAME_REQUIRED',
            'Column names are required.',
          );
        }

        const normalizedName = column.name.toLocaleLowerCase('en-US');
        if (seenNames.has(normalizedName)) {
          throw new BoardColumnConfigValidationError(
            'BOARD_COLUMN_NAME_DUPLICATE',
            'Column names must be unique.',
          );
        }
        seenNames.add(normalizedName);

        if (!column.key || seenKeys.has(column.key)) {
          throw new BoardColumnConfigValidationError(
            'BOARD_COLUMN_KEY_DUPLICATE',
            'Board column keys must be unique.',
          );
        }
        seenKeys.add(column.key);

        return column;
      });
  }

  private async getNonEmptyBoardColumnKeys(tenantId: string) {
    const operations = await this.prisma.operation.findMany({
      where: { tenantId },
      select: { startDate: true },
    });

    return new Set(
      operations.map((operation) => operation.startDate?.toISOString().slice(0, 10) ?? 'Backlog'),
    );
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
