import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, type PoolConfig } from 'pg';
import { PrismaClient } from '../../generated/prisma/client';

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

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    const schema = getSchemaFromDatabaseUrl(process.env.DATABASE_URL);
    const pool = new Pool(createPoolConfig(process.env.DATABASE_URL));

    if (schema) {
      const quotedSchema = `"${schema.replaceAll('"', '""')}"`;
      pool.on('connect', (client) => client.query(`SET search_path TO ${quotedSchema}`));
    }

    const adapter = new PrismaPg(pool);

    super({ adapter });

    this.pool = pool;
  }

  async isReady(): Promise<boolean> {
    await this.$queryRawUnsafe('SELECT 1');
    return true;
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
  }
}
