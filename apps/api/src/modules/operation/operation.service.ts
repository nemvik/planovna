import { Injectable } from '@nestjs/common';
import { assertVersion } from '../../common/optimistic-lock/assert-version';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOperationDto, UpdateOperationDto } from './dto/operation.dto';

type OperationRecord = CreateOperationDto & {
  id: string;
  version: number;
  dependencyCount: number;
  prerequisiteCodes: string[];
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
        _count: {
          select: {
            dependsOn: {
              where: {
                tenantId: input.tenantId,
                dependsOn: {
                  tenantId: input.tenantId,
                },
              },
            },
          },
        },
        dependsOn: {
          where: {
            tenantId: input.tenantId,
            dependsOn: {
              tenantId: input.tenantId,
            },
          },
          orderBy: {
            dependsOn: {
              code: 'asc',
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
              code: 'asc',
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
    const updateData = {
      ...patch,
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
        _count: {
          select: {
            dependsOn: {
              where: {
                tenantId: existing.tenantId,
                dependsOn: {
                  tenantId: existing.tenantId,
                },
              },
            },
          },
        },
        dependsOn: {
          where: {
            tenantId: existing.tenantId,
            dependsOn: {
              tenantId: existing.tenantId,
            },
          },
          orderBy: {
            dependsOn: {
              code: 'asc',
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
      dependencyCount: row._count.dependsOn,
      prerequisiteCodes: row.dependsOn.map((dependency) => dependency.dependsOn.code),
    };
  }
}
