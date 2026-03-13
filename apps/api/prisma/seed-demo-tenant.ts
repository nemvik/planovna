import { createHash } from 'crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, type PoolConfig } from 'pg';
import { PrismaClient, UserRole, OperationStatus, InvoiceStatus, CashflowKind } from '../generated/prisma/client';

type SeedSummary = {
  tenantId: string;
  userEmail: string;
  customerName: string;
  orderCode: string;
  operationCodes: string[];
  invoiceNumber: string;
};

const DEMO = {
  tenantId: 'tenant-demo',
  tenantName: 'Demo tenant',
  userId: 'u-tenant-demo-owner',
  userEmail: 'owner@tenant-demo.local',
  userPassword: 'tenant-demo-pass',
  customerName: 'Demo Manufacturing s.r.o.',
  customerEmail: 'zakazky@demo-manufacturing.local',
  orderCode: 'DEMO-ORDER-001',
  orderTitle: 'Pilot zakázka: výrobní série A',
  operationCutCode: 'OP-CUT-001',
  operationCutTitle: 'Řezání materiálu',
  operationAssemblyCode: 'OP-ASM-002',
  operationAssemblyTitle: 'Montáž sestavy',
  invoiceNumber: '2026-0001',
} as const;

function hashPassword(rawPassword: string): string {
  return createHash('sha256').update(rawPassword).digest('hex');
}

function buildSummary(): SeedSummary {
  return {
    tenantId: DEMO.tenantId,
    userEmail: DEMO.userEmail,
    customerName: DEMO.customerName,
    orderCode: DEMO.orderCode,
    operationCodes: [DEMO.operationCutCode, DEMO.operationAssemblyCode],
    invoiceNumber: DEMO.invoiceNumber,
  };
}

function getSchemaFromDatabaseUrl(databaseUrl?: string): string | undefined {
  if (!databaseUrl) {
    return undefined;
  }

  return new URL(databaseUrl).searchParams.get('schema') ?? undefined;
}

function createPoolConfig(databaseUrl?: string): PoolConfig {
  const connectionString =
    databaseUrl ?? 'postgresql://placeholder:placeholder@localhost:5432/placeholder';
  const config: PoolConfig = { connectionString };
  const schema = getSchemaFromDatabaseUrl(databaseUrl);

  if (schema) {
    config.options = `-c search_path=${schema}`;
  }

  return config;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const summary = buildSummary();

  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, summary }, null, 2));
    return;
  }

  const schema = getSchemaFromDatabaseUrl(process.env.DATABASE_URL);
  const pool = new Pool(createPoolConfig(process.env.DATABASE_URL));

  if (schema) {
    const quotedSchema = `"${schema.replaceAll('"', '""')}"`;
    pool.on('connect', (client) => client.query(`SET search_path TO ${quotedSchema}`));
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    await prisma.tenant.upsert({
      where: { id: DEMO.tenantId },
      update: { name: DEMO.tenantName },
      create: {
        id: DEMO.tenantId,
        name: DEMO.tenantName,
      },
    });

    await prisma.user.upsert({
      where: {
        tenantId_email: {
          tenantId: DEMO.tenantId,
          email: DEMO.userEmail,
        },
      },
      update: {
        passwordHash: hashPassword(DEMO.userPassword),
        role: UserRole.OWNER,
      },
      create: {
        id: DEMO.userId,
        tenantId: DEMO.tenantId,
        email: DEMO.userEmail,
        passwordHash: hashPassword(DEMO.userPassword),
        role: UserRole.OWNER,
      },
    });

    const customer = await prisma.customer.upsert({
      where: {
        tenantId_name: {
          tenantId: DEMO.tenantId,
          name: DEMO.customerName,
        },
      },
      update: {
        email: DEMO.customerEmail,
      },
      create: {
        tenantId: DEMO.tenantId,
        name: DEMO.customerName,
        email: DEMO.customerEmail,
      },
    });

    const order = await prisma.order.upsert({
      where: {
        tenantId_code: {
          tenantId: DEMO.tenantId,
          code: DEMO.orderCode,
        },
      },
      update: {
        customerId: customer.id,
        title: DEMO.orderTitle,
        status: 'OPEN',
      },
      create: {
        tenantId: DEMO.tenantId,
        customerId: customer.id,
        code: DEMO.orderCode,
        title: DEMO.orderTitle,
        status: 'OPEN',
      },
    });

    const operationCut = await prisma.operation.upsert({
      where: {
        tenantId_orderId_code: {
          tenantId: DEMO.tenantId,
          orderId: order.id,
          code: DEMO.operationCutCode,
        },
      },
      update: {
        title: DEMO.operationCutTitle,
        status: OperationStatus.READY,
        sortIndex: 10,
      },
      create: {
        tenantId: DEMO.tenantId,
        orderId: order.id,
        code: DEMO.operationCutCode,
        title: DEMO.operationCutTitle,
        status: OperationStatus.READY,
        sortIndex: 10,
      },
    });

    const operationAssembly = await prisma.operation.upsert({
      where: {
        tenantId_orderId_code: {
          tenantId: DEMO.tenantId,
          orderId: order.id,
          code: DEMO.operationAssemblyCode,
        },
      },
      update: {
        title: DEMO.operationAssemblyTitle,
        status: OperationStatus.BLOCKED,
        blockedReason: `Čeká na ${DEMO.operationCutCode}`,
        sortIndex: 20,
      },
      create: {
        tenantId: DEMO.tenantId,
        orderId: order.id,
        code: DEMO.operationAssemblyCode,
        title: DEMO.operationAssemblyTitle,
        status: OperationStatus.BLOCKED,
        blockedReason: `Čeká na ${DEMO.operationCutCode}`,
        sortIndex: 20,
      },
    });

    await prisma.operationDependency.upsert({
      where: {
        tenantId_operationId_dependsOnId: {
          tenantId: DEMO.tenantId,
          operationId: operationAssembly.id,
          dependsOnId: operationCut.id,
        },
      },
      update: {},
      create: {
        tenantId: DEMO.tenantId,
        operationId: operationAssembly.id,
        dependsOnId: operationCut.id,
      },
    });

    const invoice = await prisma.invoice.upsert({
      where: {
        tenantId_number: {
          tenantId: DEMO.tenantId,
          number: DEMO.invoiceNumber,
        },
      },
      update: {
        orderId: order.id,
        status: InvoiceStatus.ISSUED,
        currency: 'CZK',
        amountNet: '100000.00',
        amountVat: '21000.00',
        amountGross: '121000.00',
        issuedAt: new Date('2026-03-01T00:00:00.000Z'),
        dueAt: new Date('2026-03-15T00:00:00.000Z'),
      },
      create: {
        tenantId: DEMO.tenantId,
        orderId: order.id,
        number: DEMO.invoiceNumber,
        status: InvoiceStatus.ISSUED,
        currency: 'CZK',
        amountNet: '100000.00',
        amountVat: '21000.00',
        amountGross: '121000.00',
        issuedAt: new Date('2026-03-01T00:00:00.000Z'),
        dueAt: new Date('2026-03-15T00:00:00.000Z'),
      },
    });

    await prisma.cashflowItem.upsert({
      where: {
        id: `${DEMO.tenantId}-planned-in-001`,
      },
      update: {
        tenantId: DEMO.tenantId,
        invoiceId: invoice.id,
        kind: CashflowKind.PLANNED_IN,
        currency: 'CZK',
        amount: '121000.00',
        date: new Date('2026-03-15T00:00:00.000Z'),
        note: `Úhrada ${DEMO.invoiceNumber}`,
      },
      create: {
        id: `${DEMO.tenantId}-planned-in-001`,
        tenantId: DEMO.tenantId,
        invoiceId: invoice.id,
        kind: CashflowKind.PLANNED_IN,
        currency: 'CZK',
        amount: '121000.00',
        date: new Date('2026-03-15T00:00:00.000Z'),
        note: `Úhrada ${DEMO.invoiceNumber}`,
      },
    });

    console.log(JSON.stringify({ dryRun: false, summary }, null, 2));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
