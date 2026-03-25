import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, type PoolConfig } from 'pg';
import { PrismaClient } from '../../generated/prisma/client';

function readDatabaseUrlFromEnvFile(): string | undefined {
  const candidates = [join(process.cwd(), 'apps/api/.env'), join(process.cwd(), '.env')];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue;
    }

    const content = readFileSync(candidate, 'utf8');
    const line = content
      .split(/\r?\n/)
      .find((entry) => entry.trim().startsWith('DATABASE_URL='));

    if (!line) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    const rawValue = separatorIndex >= 0 ? line.slice(separatorIndex + 1) : '';
    const value = rawValue.trim().replace(/^['\"]|['\"]$/g, '');
    if (value) {
      return value;
    }
  }

  return undefined;
}

function resolveDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL ?? readDatabaseUrlFromEnvFile();
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

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    const databaseUrl = resolveDatabaseUrl();
    const schema = getSchemaFromDatabaseUrl(databaseUrl);
    const pool = new Pool(createPoolConfig(databaseUrl));

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
