#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const PLANOVNA_TABLES = [
  'Tenant',
  'User',
  'Customer',
  'Order',
  'Operation',
  'OperationDependency',
  'Invoice',
  'CashflowItem',
];

const PLANOVNA_ENUMS = [
  'UserRole',
  'OperationStatus',
  'InvoiceStatus',
  'CashflowKind',
];

function readDatabaseUrlFromWorkspace() {
  const candidates = [
    process.env.DATABASE_URL,
    path.join(process.cwd(), 'apps/api/.env'),
    path.join(process.cwd(), '.env'),
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (candidate.startsWith('postgres://') || candidate.startsWith('postgresql://')) {
      return candidate;
    }

    if (!fs.existsSync(candidate)) {
      continue;
    }

    const content = fs.readFileSync(candidate, 'utf8');
    const line = content.split(/\r?\n/).find((entry) => entry.trim().startsWith('DATABASE_URL='));
    if (!line) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    const rawValue = separatorIndex >= 0 ? line.slice(separatorIndex + 1) : '';
    const value = rawValue.trim().replace(/^['"]|['"]$/g, '');
    if (value) {
      return value;
    }
  }

  return undefined;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function evaluateSchemaDrift(inventory) {
  const appTables = new Set(inventory.tablesBySchema.app ?? []);
  const publicTables = uniqueSorted((inventory.tablesBySchema.public ?? []).filter((name) => PLANOVNA_TABLES.includes(name)));
  const appEnums = new Set(inventory.enumsBySchema.app ?? []);
  const publicEnums = uniqueSorted((inventory.enumsBySchema.public ?? []).filter((name) => PLANOVNA_ENUMS.includes(name)));

  const missingAppTables = PLANOVNA_TABLES.filter((name) => !appTables.has(name));
  const missingAppEnums = PLANOVNA_ENUMS.filter((name) => !appEnums.has(name));

  return {
    ok:
      missingAppTables.length === 0 &&
      missingAppEnums.length === 0 &&
      publicTables.length === 0 &&
      publicEnums.length === 0,
    missingAppTables,
    missingAppEnums,
    publicTables,
    publicEnums,
  };
}

async function main() {
  const databaseUrl = readDatabaseUrlFromWorkspace();

  if (!databaseUrl) {
    console.error('[schema-drift] DATABASE_URL is not set and no workspace env file provided one');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const [tableRows, enumRows] = await Promise.all([
      client.query(`
        select table_schema, table_name
        from information_schema.tables
        where table_schema in ('app', 'public')
          and table_type = 'BASE TABLE'
        order by table_schema, table_name
      `),
      client.query(`
        select n.nspname as schema_name, t.typname as type_name
        from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname in ('app', 'public')
          and t.typtype = 'e'
        order by n.nspname, t.typname
      `),
    ]);

    const inventory = {
      tablesBySchema: {},
      enumsBySchema: {},
    };

    for (const row of tableRows.rows) {
      inventory.tablesBySchema[row.table_schema] ??= [];
      inventory.tablesBySchema[row.table_schema].push(row.table_name);
    }

    for (const row of enumRows.rows) {
      inventory.enumsBySchema[row.schema_name] ??= [];
      inventory.enumsBySchema[row.schema_name].push(row.type_name);
    }

    const report = evaluateSchemaDrift(inventory);

    console.log(JSON.stringify({ inventory, report }, null, 2));

    if (!report.ok) {
      console.error('[schema-drift] Drift detected. See report above.');
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('[schema-drift] Check failed');
  console.error(error);
  process.exit(1);
});
