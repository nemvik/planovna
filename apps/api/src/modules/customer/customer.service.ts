import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { assertVersion } from '../../common/optimistic-lock/assert-version';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

type CustomerRecord = CreateCustomerDto & { id: string; version: number };

@Injectable()
export class CustomerService {
  private readonly db = new Map<string, CustomerRecord>();

  constructor(private readonly prisma?: PrismaService) {}

  async create(input: CreateCustomerDto) {
    if (!this.prisma) {
      const id = randomUUID();
      const row: CustomerRecord = { ...input, id, version: 1 };
      this.db.set(id, row);
      return row;
    }

    await this.prisma.tenant.upsert({
      where: { id: input.tenantId },
      update: {},
      create: {
        id: input.tenantId,
        name: input.tenantId,
      },
    });

    const created = await this.prisma.customer.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        ic: input.ic,
        dic: input.dic,
        email: input.email,
        phone: input.phone,
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        ic: true,
        dic: true,
        email: true,
        phone: true,
        version: true,
      },
    });

    const row: CustomerRecord = {
      ...created,
      ic: created.ic ?? undefined,
      dic: created.dic ?? undefined,
      email: created.email ?? undefined,
      phone: created.phone ?? undefined,
    };

    this.db.set(row.id, row);
    return row;
  }

  async list(tenantId: string) {
    if (!this.prisma) {
      return Array.from(this.db.values()).filter((x) => x.tenantId === tenantId);
    }

    const customers = await this.prisma.customer.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        tenantId: true,
        name: true,
        ic: true,
        dic: true,
        email: true,
        phone: true,
        version: true,
      },
    });

    return customers.map((customer) => ({
      ...customer,
      ic: customer.ic ?? undefined,
      dic: customer.dic ?? undefined,
      email: customer.email ?? undefined,
      phone: customer.phone ?? undefined,
    }));
  }

  async update(input: UpdateCustomerDto) {
    if (!this.prisma) {
      const row = this.db.get(input.id);
      if (!row || row.tenantId !== input.tenantId) return null;

      assertVersion('Customer', row.id, input.version, row.version);

      const { tenantId: _ignoredTenantId, ...patch } = input;
      const next = { ...row, ...patch, tenantId: row.tenantId, version: row.version + 1 };
      this.db.set(row.id, next);
      return next;
    }

    const existing = await this.prisma.customer.findUnique({
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

    assertVersion('Customer', existing.id, input.version, existing.version);

    const {
      id: _ignoredId,
      tenantId: _ignoredTenantId,
      version: _ignoredVersion,
      ...patch
    } = input;

    const updated = await this.prisma.customer.updateMany({
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
      const latest = await this.prisma.customer.findUnique({
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

      assertVersion('Customer', latest.id, input.version, latest.version);
    }

    const row = await this.prisma.customer.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        tenantId: true,
        name: true,
        ic: true,
        dic: true,
        email: true,
        phone: true,
        version: true,
      },
    });

    if (!row) {
      return null;
    }

    return {
      ...row,
      ic: row.ic ?? undefined,
      dic: row.dic ?? undefined,
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
    };
  }
}
