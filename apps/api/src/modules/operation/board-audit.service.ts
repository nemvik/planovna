import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type BoardAuditEventRecord = {
  id: string;
  tenantId: string;
  actorUserId?: string;
  entityType: string;
  entityId: string;
  action: string;
  summary: string;
  createdAt: string;
};

@Injectable()
export class BoardAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async append(input: {
    tenantId: string;
    actorUserId?: string;
    entityType: string;
    entityId: string;
    action: string;
    summary: string;
  }) {
    await this.prisma.boardAuditEvent.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        summary: input.summary,
      },
    });
  }

  async list(tenantId: string, limit = 50): Promise<BoardAuditEventRecord[]> {
    const rows = await this.prisma.boardAuditEvent.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      actorUserId: row.actorUserId ?? undefined,
      entityType: row.entityType,
      entityId: row.entityId,
      action: row.action,
      summary: row.summary,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
