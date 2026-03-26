export const PLANOVNA_TABLES = [
  'Tenant',
  'User',
  'Customer',
  'Order',
  'Operation',
  'OperationDependency',
  'Invoice',
  'CashflowItem',
] as const;

export const PLANOVNA_ENUMS = [
  'UserRole',
  'OperationStatus',
  'InvoiceStatus',
  'CashflowKind',
] as const;

export type SchemaInventory = {
  tablesBySchema: Record<string, string[]>;
  enumsBySchema: Record<string, string[]>;
};

export type SchemaDriftReport = {
  ok: boolean;
  missingAppTables: string[];
  missingAppEnums: string[];
  publicTables: string[];
  publicEnums: string[];
};

const uniqueSorted = (values: readonly string[]) => [...new Set(values)].sort();

export function evaluateSchemaDrift(inventory: SchemaInventory): SchemaDriftReport {
  const appTables = new Set(inventory.tablesBySchema.app ?? []);
  const publicTables = uniqueSorted(
    (inventory.tablesBySchema.public ?? []).filter((name) =>
      PLANOVNA_TABLES.includes(name as (typeof PLANOVNA_TABLES)[number]),
    ),
  );

  const appEnums = new Set(inventory.enumsBySchema.app ?? []);
  const publicEnums = uniqueSorted(
    (inventory.enumsBySchema.public ?? []).filter((name) =>
      PLANOVNA_ENUMS.includes(name as (typeof PLANOVNA_ENUMS)[number]),
    ),
  );

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
