import { Injectable } from '@nestjs/common';
import { BoardAuditService } from '../operation/board-audit.service';
import { assertVersion } from '../../common/optimistic-lock/assert-version';
import { PrismaService } from '../../prisma/prisma.service';
import { ApplyRoutingTemplateDto, CreateOrderDto, UpdateOrderDto } from './dto/order.dto';

type OrderRecord = CreateOrderDto & { id: string; version: number };

type RoutingTemplateRecord = {
  id: string;
  name: string;
  description: string;
  operations: Array<{
    code: string;
    title: string;
    status: 'READY';
    sortIndex: number;
  }>;
};

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

const ROUTING_TEMPLATES: RoutingTemplateRecord[] = [
  {
    id: 'standard-casting',
    name: 'Standard casting flow',
    description: 'Pattern prep -> mould -> casting -> finishing -> QA',
    operations: [
      { code: 'TPL-10', title: 'Pattern preparation', status: 'READY', sortIndex: 1000 },
      { code: 'TPL-20', title: 'Mould preparation', status: 'READY', sortIndex: 2000 },
      { code: 'TPL-30', title: 'Casting', status: 'READY', sortIndex: 3000 },
      { code: 'TPL-40', title: 'Finishing', status: 'READY', sortIndex: 4000 },
      { code: 'TPL-50', title: 'Quality check', status: 'READY', sortIndex: 5000 },
    ],
  },
  {
    id: 'express-repair',
    name: 'Express repair flow',
    description: 'Intake -> repair -> verification -> release',
    operations: [
      { code: 'TPL-10', title: 'Intake check', status: 'READY', sortIndex: 1000 },
      { code: 'TPL-20', title: 'Repair work', status: 'READY', sortIndex: 2000 },
      { code: 'TPL-30', title: 'Verification', status: 'READY', sortIndex: 3000 },
      { code: 'TPL-40', title: 'Release', status: 'READY', sortIndex: 4000 },
    ],
  },
];

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardAuditService: BoardAuditService,
  ) {}

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

  listRoutingTemplates() {
    return ROUTING_TEMPLATES;
  }

  async applyRoutingTemplate(
    tenantId: string,
    input: ApplyRoutingTemplateDto & { actorUserId?: string },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: input.orderId },
      select: { id: true, tenantId: true, code: true },
    });

    if (!order || order.tenantId !== tenantId) {
      return null;
    }

    const template = ROUTING_TEMPLATES.find((candidate) => candidate.id === input.templateId);
    if (!template) {
      return { code: 'TEMPLATE_NOT_FOUND' as const };
    }

    const existingCount = await this.prisma.operation.count({
      where: { tenantId, orderId: input.orderId },
    });

    const suffix = String(existingCount + 1).padStart(2, '0');

    await this.prisma.operation.createMany({
      data: template.operations.map((operation, index) => ({
        tenantId,
        orderId: input.orderId,
        code: `${operation.code}-${suffix}-${index + 1}`,
        title: operation.title,
        status: operation.status,
        sortIndex: existingCount * 1000 + operation.sortIndex,
      })),
    });

    await this.boardAuditService.append({
      tenantId,
      actorUserId: input.actorUserId,
      entityType: 'order',
      entityId: order.id,
      action: 'routing_template_apply',
      summary: `${order.code}: applied routing template ${template.name}`,
    });

    return {
      appliedCount: template.operations.length,
      template,
      operations: (await this.prisma.operation.findMany({
        where: { tenantId, orderId: input.orderId },
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
          _count: { select: { dependsOn: true } },
          dependsOn: {
            orderBy: { dependsOn: { code: 'asc' } },
            take: 3,
            select: { dependsOn: { select: { code: true } } },
          },
        },
      })).map((operation) => ({
        id: operation.id,
        tenantId: operation.tenantId,
        orderId: operation.orderId,
        code: operation.code,
        title: operation.title,
        status: operation.status,
        startDate: operation.startDate?.toISOString(),
        endDate: operation.endDate?.toISOString(),
        sortIndex: operation.sortIndex,
        blockedReason: operation.blockedReason ?? undefined,
        version: operation.version,
        dependencyCount: operation._count.dependsOn,
        prerequisiteCodes: operation.dependsOn.map((dependency) => dependency.dependsOn.code),
        prerequisiteOverflowCount: Math.max(0, operation._count.dependsOn - operation.dependsOn.length),
      })),
    };
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
