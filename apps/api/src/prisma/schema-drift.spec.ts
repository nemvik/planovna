import { evaluateSchemaDrift } from './schema-drift';

describe('evaluateSchemaDrift', () => {
  it('passes when all required objects exist only in app schema', () => {
    const report = evaluateSchemaDrift({
      tablesBySchema: {
        app: [
          'Tenant',
          'User',
          'Customer',
          'Order',
          'Operation',
          'OperationDependency',
          'Invoice',
          'CashflowItem',
        ],
      },
      enumsBySchema: {
        app: ['UserRole', 'OperationStatus', 'InvoiceStatus', 'CashflowKind'],
      },
    });

    expect(report).toEqual({
      ok: true,
      missingAppTables: [],
      missingAppEnums: [],
      publicTables: [],
      publicEnums: [],
    });
  });

  it('flags missing app objects and duplicate public objects', () => {
    const report = evaluateSchemaDrift({
      tablesBySchema: {
        app: ['Tenant', 'User'],
        public: ['User', 'Invoice', 'Unrelated'],
      },
      enumsBySchema: {
        app: ['UserRole'],
        public: ['InvoiceStatus', 'OtherEnum'],
      },
    });

    expect(report.ok).toBe(false);
    expect(report.missingAppTables).toEqual([
      'Customer',
      'Order',
      'Operation',
      'OperationDependency',
      'Invoice',
      'CashflowItem',
    ]);
    expect(report.missingAppEnums).toEqual([
      'OperationStatus',
      'InvoiceStatus',
      'CashflowKind',
    ]);
    expect(report.publicTables).toEqual(['Invoice', 'User']);
    expect(report.publicEnums).toEqual(['InvoiceStatus']);
  });
});
