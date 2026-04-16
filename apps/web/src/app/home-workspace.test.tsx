import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Home, { HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY } from './home-workspace';
import { createTrpcClient } from '../lib/trpc/client';

jest.mock('../lib/trpc/client', () => ({
  createTrpcClient: jest.fn(),
}));

const createClient = () => ({
  auth: {
    login: { mutate: jest.fn() },
    register: { mutate: jest.fn() },
  },
  operation: {
    list: { query: jest.fn().mockResolvedValue([]) },
    update: { mutate: jest.fn() },
    auditLog: { query: jest.fn().mockResolvedValue([]) },
    listBoardColumns: { query: jest.fn().mockResolvedValue([]) },
    saveBoardColumns: { mutate: jest.fn() },
  },
  order: {
    list: { query: jest.fn().mockResolvedValue([]) },
    routingTemplates: { query: jest.fn().mockResolvedValue([]) },
  },
  cashflow: {
    list: { query: jest.fn().mockResolvedValue([]) },
    listRecurringRules: { query: jest.fn().mockResolvedValue([]) },
  },
  invoice: {
    list: { query: jest.fn().mockResolvedValue([]) },
  },
});

beforeEach(() => {
  window.localStorage.clear();
  jest.clearAllMocks();
});

const renderWithClient = (client: ReturnType<typeof createClient>) => {
  const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;
  createTrpcClientMock.mockImplementation(() => client as never);
  return render(<Home />);
};

const loginAndLoadWorkspace = async (client: ReturnType<typeof createClient>) => {
  client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
  renderWithClient(client);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), 'owner@tenant-a.local');
  await user.type(screen.getByLabelText('Password'), 'tenant-a-pass');
  await user.click(screen.getByRole('button', { name: 'Login' }));
  await waitFor(() => {
    expect(client.auth.login.mutate).toHaveBeenCalledTimes(1);
  });
  await waitFor(() => {
    expect(client.operation.list.query).toHaveBeenCalledTimes(1);
  });
};

const loadAuthenticatedWorkspace = async (client: ReturnType<typeof createClient>) => {
  window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');
  renderWithClient(client);
  await waitFor(() => {
    expect(client.operation.list.query).toHaveBeenCalledTimes(1);
  });
};

describe('extracted shared workspace harness', () => {
  it('mounts the shared workspace contract instead of the dashboard shell', () => {
    const client = createClient();
    renderWithClient(client);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Continue in Board' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open Invoices' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open Cashflow' })).not.toBeInTheDocument();
  });

  it('frames the board as the planning step between orders and finance follow-up', async () => {
    const client = createClient();

    await loadAuthenticatedWorkspace(client);

    expect(
      screen.getByText(
        'The planning step between Orders and later finance follow-up, where operations move between backlog and loaded start-date buckets.',
      ),
    ).toBeInTheDocument();
  });

  it('renders trustworthy customer billing-address snapshot lines when 2+ non-empty lines exist', async () => {
    const client = createClient();
    client.invoice.list.query.mockResolvedValue([
      {
        id: 'inv-1',
        number: '2026-0001',
        status: 'ISSUED',
        amountNet: 100000,
        amountVat: 21000,
        amountGross: 121000,
        vatRatePercent: 21,
        hasBreakdown: true,
        currency: 'CZK',
        customerBillingAddressLines: ['Acme Interiors s.r.o.', 'Masarykova 12', '602 00 Brno'],
        pdfPath: '/invoices/inv-1/pdf',
      },
    ]);

    await loadAuthenticatedWorkspace(client);

    expect(screen.getByText('Customer billing address')).toBeInTheDocument();
    expect(screen.getByText('Acme Interiors s.r.o.')).toBeInTheDocument();
    expect(screen.getByText('Masarykova 12')).toBeInTheDocument();
    expect(screen.getByText('602 00 Brno')).toBeInTheDocument();
  });

  it('falls back explicitly when the customer billing-address snapshot is too incomplete', async () => {
    const client = createClient();
    client.invoice.list.query.mockResolvedValue([
      {
        id: 'inv-2',
        number: '2026-0002',
        status: 'DRAFT',
        amountNet: 50000,
        amountVat: 10500,
        amountGross: 60500,
        vatRatePercent: 21,
        hasBreakdown: true,
        currency: 'CZK',
        customerBillingAddressLines: ['Single line only'],
        pdfPath: '/invoices/inv-2/pdf',
      },
    ]);

    await loadAuthenticatedWorkspace(client);

    expect(screen.getByText('Billing address for this customer on the invoice is not available.')).toBeInTheDocument();
    expect(screen.queryByText('Single line only')).not.toBeInTheDocument();
  });

  it('renders supplier company-id only from the invoice snapshot and otherwise falls back explicitly', async () => {
    const client = createClient();
    client.invoice.list.query.mockResolvedValue([
      {
        id: 'inv-company-present',
        number: '2026-0042',
        status: 'ISSUED',
        amountNet: 100000,
        amountVat: 21000,
        amountGross: 121000,
        vatRatePercent: 21,
        hasBreakdown: true,
        currency: 'CZK',
        supplierCompanyId: '27888998',
        supplierTaxId: 'CZ27888998',
        pdfPath: '/invoices/inv-company-present/pdf',
      },
      {
        id: 'inv-company-missing',
        number: '2026-0043',
        status: 'DRAFT',
        amountNet: 50000,
        amountVat: 10500,
        amountGross: 60500,
        vatRatePercent: 21,
        hasBreakdown: true,
        currency: 'CZK',
        supplierTaxId: 'CZ11111111',
        pdfPath: '/invoices/inv-company-missing/pdf',
      },
    ]);

    await loadAuthenticatedWorkspace(client);

    expect(screen.getAllByText('Supplier company ID')).toHaveLength(2);
    expect(screen.getByText('27888998')).toBeInTheDocument();
    expect(screen.getByText('Company ID for this invoice is not available.')).toBeInTheDocument();
    expect(screen.getAllByText('Supplier tax ID')).toHaveLength(2);
  });

  it('renders issue date only from the explicit issuedAt value and otherwise falls back explicitly', async () => {
    const client = createClient();
    client.invoice.list.query.mockResolvedValue([
      {
        id: 'inv-issued-present',
        number: '2026-0050',
        status: 'ISSUED',
        amountNet: 100000,
        amountVat: 21000,
        amountGross: 121000,
        vatRatePercent: 21,
        hasBreakdown: true,
        currency: 'CZK',
        issuedAt: '2026-04-01T00:00:00.000Z',
        dueAt: '2026-04-14T00:00:00.000Z',
        pdfPath: '/invoices/inv-issued-present/pdf',
      },
      {
        id: 'inv-issued-missing',
        number: '2026-0051',
        status: 'ISSUED',
        amountNet: 50000,
        amountVat: 10500,
        amountGross: 60500,
        vatRatePercent: 21,
        hasBreakdown: true,
        currency: 'CZK',
        dueAt: '2026-04-20T00:00:00.000Z',
        pdfPath: '/invoices/inv-issued-missing/pdf',
      },
    ]);

    await loadAuthenticatedWorkspace(client);

    expect(screen.getAllByText('Issue date')).toHaveLength(2);
    expect(screen.getByText('04/01/2026')).toBeInTheDocument();
    expect(screen.getByText('Datum vystavení této faktury není dostupné.')).toBeInTheDocument();
    expect(screen.getByText('04/20/2026')).toBeInTheDocument();
  });

  it('renders due date only from the explicit dueAt value and otherwise falls back explicitly', async () => {
    const client = createClient();
    client.invoice.list.query.mockResolvedValue([
      {
        id: 'inv-due-present',
        number: '2026-0060',
        status: 'ISSUED',
        amountNet: 100000,
        amountVat: 21000,
        amountGross: 121000,
        vatRatePercent: 21,
        hasBreakdown: true,
        currency: 'CZK',
        issuedAt: '2026-04-01T00:00:00.000Z',
        dueAt: '2026-04-14T00:00:00.000Z',
        pdfPath: '/invoices/inv-due-present/pdf',
      },
      {
        id: 'inv-due-missing',
        number: '2026-0061',
        status: 'ISSUED',
        amountNet: 50000,
        amountVat: 10500,
        amountGross: 60500,
        vatRatePercent: 21,
        hasBreakdown: true,
        currency: 'CZK',
        issuedAt: '2026-04-05T00:00:00.000Z',
        pdfPath: '/invoices/inv-due-missing/pdf',
      },
    ]);

    await loadAuthenticatedWorkspace(client);

    expect(screen.getAllByText('Due date')).toHaveLength(2);
    expect(screen.getByText('04/14/2026')).toBeInTheDocument();
    expect(screen.getByText('Datum splatnosti této faktury není dostupné.')).toBeInTheDocument();
  });

  it('shows shortcut discovery with only existing safe board actions', async () => {
    const client = createClient();
    client.operation.list.query.mockResolvedValue([
      {
        id: 'op-1',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'CUT-01',
        title: 'Cut panels',
        status: 'READY',
        startDate: undefined,
        endDate: undefined,
        sortIndex: 1,
        version: 3,
        dependencyCount: 0,
        prerequisiteCodes: [],
      },
    ]);

    await loadAuthenticatedWorkspace(client);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Shortcuts' }));

    expect(screen.getByRole('region', { name: 'Board shortcuts' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Load operations' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Open audit log' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Edit board columns' }).length).toBeGreaterThan(0);
    expect(screen.getByText('Use “Move to bucket” on a card as the explicit non-drag-and-drop fallback.')).toBeInTheDocument();
  });

  it('uses the existing move action as a quick non-dnd fallback from the card', async () => {
    const client = createClient();
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-06T10:00:00.000Z').getTime());
    client.operation.list.query.mockResolvedValue([
      {
        id: 'op-1',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'CUT-01',
        title: 'Cut panels',
        status: 'READY',
        startDate: '2026-04-06T00:00:00.000Z',
        endDate: undefined,
        sortIndex: 1,
        version: 3,
        dependencyCount: 0,
        prerequisiteCodes: [],
      },
      {
        id: 'op-2',
        tenantId: 'tenant-a',
        orderId: 'ord-2',
        code: 'EDGE-02',
        title: 'Edge banding',
        status: 'READY',
        startDate: '2026-04-07T00:00:00.000Z',
        endDate: undefined,
        sortIndex: 2,
        version: 1,
        dependencyCount: 0,
        prerequisiteCodes: [],
      },
    ]);
    client.operation.update.mutate.mockResolvedValue({
      id: 'op-1',
      tenantId: 'tenant-a',
      orderId: 'ord-1',
      code: 'CUT-01',
      title: 'Cut panels',
      status: 'READY',
      startDate: '2026-04-07T00:00:00.000Z',
      endDate: undefined,
      sortIndex: 1,
      version: 4,
      dependencyCount: 0,
      prerequisiteCodes: [],
    });

    await loadAuthenticatedWorkspace(client);

    const user = userEvent.setup();
    expect(screen.queryByLabelText('Move to bucket')).not.toBeInTheDocument();
    expect(screen.queryByText('Dependencies')).not.toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Expand details' })[0]);
    expect(screen.getByText('Dependencies')).toBeInTheDocument();
    await user.selectOptions(screen.getAllByLabelText('Move to bucket')[0], '2026-04-07');

    await waitFor(() => {
      expect(client.operation.update.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'op-1',
          startDate: '2026-04-07T00:00:00.000Z',
        }),
      );
    });
  });

  it('reloads the board state after a reorder conflict', async () => {
    const client = createClient();
    const operations = [
      {
        id: 'op-1',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'CUT-01',
        title: 'Cut panels',
        status: 'READY',
        startDate: null,
        endDate: undefined,
        sortIndex: 1,
        version: 1,
        dependencyCount: 0,
        prerequisiteCodes: [],
      },
      {
        id: 'op-2',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'ASM-02',
        title: 'Assemble frame',
        status: 'BLOCKED',
        blockedReason: 'Missing cut panels',
        startDate: '2026-04-07T00:00:00.000Z',
        endDate: undefined,
        sortIndex: 2,
        version: 1,
        dependencyCount: 1,
        prerequisiteCodes: ['CUT-01'],
      },
      {
        id: 'op-3',
        tenantId: 'tenant-a',
        orderId: 'ord-2',
        code: 'FIN-03',
        title: 'Final inspection',
        status: 'READY',
        startDate: '2026-04-07T00:00:00.000Z',
        endDate: undefined,
        sortIndex: 3,
        version: 1,
        dependencyCount: 0,
        prerequisiteCodes: [],
      },
    ];
    client.operation.list.query.mockResolvedValue(operations);
    client.operation.update.mutate.mockRejectedValueOnce({
      data: { code: 'CONFLICT', conflict: { entity: 'Operation', id: 'op-1' } },
    });

    await loadAuthenticatedWorkspace(client);

    const user = userEvent.setup();
    await user.click(screen.getAllByRole('button', { name: 'Expand details' })[0]);
    await user.selectOptions(screen.getAllByLabelText('Move to bucket')[0], '2026-04-07');

    await waitFor(() => {
      expect(client.operation.update.mutate).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(client.operation.list.query).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText('Board was out of date. Reloaded latest operations, please try again.')).toBeInTheDocument();
  });

  it('keeps finance on lightweight handoffs so planning stays primary on the board', async () => {
    const client = createClient();
    client.invoice.list.query.mockResolvedValue([
      {
        id: 'inv-1',
        number: '2026-0100',
        status: 'ISSUED',
        amountNet: 100000,
        amountVat: 21000,
        amountGross: 121000,
        vatRatePercent: 21,
        hasBreakdown: true,
        currency: 'CZK',
        pdfPath: '/invoices/inv-1/pdf',
      },
    ]);
    client.cashflow.list.query.mockResolvedValue([
      {
        id: 'cf-1',
        tenantId: 'tenant-a',
        invoiceId: 'inv-1',
        kind: 'PLANNED_IN',
        amount: 121000,
        currency: 'CZK',
        date: '2026-04-20T00:00:00.000Z',
      },
    ]);

    await loadAuthenticatedWorkspace(client);

    expect(screen.getByText('Planning stays on Board')).toBeInTheDocument();
    expect(screen.getByText('Board is the planning workspace. Use the dedicated finance modules only when work needs invoice review or cashflow follow-up.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open invoices' })).toHaveAttribute('href', '/invoices');
    expect(screen.getByRole('link', { name: 'Open cashflow' })).toHaveAttribute('href', '/cashflow');
    expect(screen.queryByText('Recurring cashflow')).not.toBeInTheDocument();
    expect(screen.queryByText('Invoice rows')).not.toBeInTheDocument();
  });

  it('shows current view presets and applies the blocked quick view using existing filters only', async () => {
    const client = createClient();
    client.operation.list.query.mockResolvedValue([
      {
        id: 'op-ready',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'CUT-01',
        title: 'Cut panels',
        status: 'READY',
        sortIndex: 1,
        version: 1,
        dependencyCount: 0,
        prerequisiteCodes: [],
      },
      {
        id: 'op-blocked',
        tenantId: 'tenant-a',
        orderId: 'ord-2',
        code: 'EDGE-02',
        title: 'Edge banding',
        status: 'BLOCKED',
        blockedReason: 'Waiting for material',
        sortIndex: 2,
        version: 1,
        dependencyCount: 0,
        prerequisiteCodes: [],
      },
    ]);

    await loadAuthenticatedWorkspace(client);

    expect(screen.getByText('Current view')).toBeInTheDocument();
    expect(screen.getAllByText('All work').length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Blocked' }));

    expect(screen.getByText('Status — Blocked')).toBeInTheDocument();
    expect(screen.getByText('EDGE-02 — Edge banding')).toBeInTheDocument();
    expect(screen.queryByText('CUT-01 — Cut panels')).not.toBeInTheDocument();
  });

  it('shows a clearer empty-board state when no operations exist at all', async () => {
    const client = createClient();

    await loadAuthenticatedWorkspace(client);

    expect(screen.getByText('The board is empty right now.')).toBeInTheDocument();
    expect(screen.getByText('No operations found.')).toBeInTheDocument();
    expect(screen.queryByText('No operations match the current filters.')).not.toBeInTheDocument();
  });

  it('does not substitute indirect customer data into the billing-address block when the snapshot is missing', async () => {
    const client = createClient();
    client.order.list.query.mockResolvedValue([
      {
        id: 'ord-1',
        orderNumber: 'ORD-1',
        customerName: 'Indirect CRM Customer',
        status: 'OPEN',
      },
    ]);
    client.invoice.list.query.mockResolvedValue([
      {
        id: 'inv-3',
        number: '2026-0003',
        status: 'ISSUED',
        amountNet: 25000,
        amountVat: 5250,
        amountGross: 30250,
        vatRatePercent: 21,
        hasBreakdown: true,
        currency: 'CZK',
        customerTaxId: 'CZ99999999',
        pdfPath: '/invoices/inv-3/pdf',
      },
    ]);

    await loadAuthenticatedWorkspace(client);

    expect(screen.getByText('Billing address for this customer on the invoice is not available.')).toBeInTheDocument();
    expect(screen.queryByText('Indirect CRM Customer')).not.toBeInTheDocument();
  });
});
