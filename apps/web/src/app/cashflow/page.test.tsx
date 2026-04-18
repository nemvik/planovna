import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CashflowPage from './page';
import { createTrpcClient } from '../../lib/trpc/client';
import { HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY } from '../home-workspace';

jest.mock('../../lib/trpc/client', () => ({
  createTrpcClient: jest.fn(),
}));

const createClient = () => ({
  cashflow: {
    list: { query: jest.fn() },
    listRecurringRules: { query: jest.fn() },
    createManualItem: { mutate: jest.fn() },
    createRecurringRule: { mutate: jest.fn() },
    updateRecurringRule: { mutate: jest.fn() },
    pauseRecurringRule: { mutate: jest.fn() },
    resumeRecurringRule: { mutate: jest.fn() },
    stopRecurringRule: { mutate: jest.fn() },
    removeRecurringRule: { mutate: jest.fn() },
  },
});

describe('cashflow workspace v1', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the login workspace before authentication', () => {
    render(<CashflowPage />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Cashflow' })).not.toBeInTheDocument();
  });

  it('renders the cashflow workspace with recurring rules, summary cards, filters, and a list after loading', async () => {
    const client = createClient();
    client.cashflow.list.query.mockResolvedValue([
      {
        id: 'cf-1',
        tenantId: 'tenant-a',
        invoiceId: 'inv-1',
        kind: 'PLANNED_IN',
        amount: 121000,
        currency: 'CZK',
        date: '2026-04-15T00:00:00.000Z',
      },
      {
        id: 'cf-2',
        tenantId: 'tenant-a',
        invoiceId: 'inv-2',
        kind: 'ACTUAL_IN',
        amount: 60500,
        currency: 'CZK',
        date: '2026-03-20T00:00:00.000Z',
      },
    ]);
    client.cashflow.listRecurringRules.query.mockResolvedValue([
      {
        id: 'rule-1',
        tenantId: 'tenant-a',
        label: 'Studio rent',
        amount: 450000,
        currency: 'CZK',
        interval: 'MONTHLY',
        startDate: '2026-04-01T00:00:00.000Z',
        nextRunAt: '2026-04-01T00:00:00.000Z',
        note: 'Recurring rent',
        status: 'ACTIVE',
        version: 1,
      },
    ]);

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-01T10:00:00.000Z').getTime());
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;
    createTrpcClientMock.mockImplementation(() => client as never);

    render(<CashflowPage />);

    await waitFor(() => {
      expect(screen.getByText('Studio rent')).toBeInTheDocument();
    });

    expect(client.cashflow.list.query).toHaveBeenCalledTimes(1);
    expect(client.cashflow.listRecurringRules.query).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Cashflow' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add cashflow item' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open invoices' })).toHaveAttribute('href', '/invoices');
    expect(screen.getByText('Cashflow stays list-first for current items. Local operations here currently apply to recurring cashflow rules only.')).toBeInTheDocument();
    expect(screen.getByText('Recurring cashflow rules')).toBeInTheDocument();
    expect(screen.getByText('All items')).toBeInTheDocument();
    expect(screen.getAllByText('Invoice-linked').length).toBeGreaterThan(0);
    expect(screen.getByText('Invoice reference: inv-1')).toBeInTheDocument();
    expect(screen.getAllByText('Planned in').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Actual in').length).toBeGreaterThan(0);
  });

  it('creates a manual cashflow item locally', async () => {
    const client = createClient();
    client.cashflow.list.query.mockResolvedValue([]);
    client.cashflow.listRecurringRules.query.mockResolvedValue([]);
    client.cashflow.createManualItem.mutate.mockResolvedValue({
      id: 'cf-manual-1',
      tenantId: 'tenant-a',
      invoiceId: null,
      kind: 'ACTUAL_IN',
      amount: 99000,
      currency: 'CZK',
      date: '2026-04-20T00:00:00.000Z',
    });

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;
    createTrpcClientMock.mockImplementation(() => client as never);

    render(<CashflowPage />);

    await waitFor(() => {
      expect(client.cashflow.list.query).toHaveBeenCalledTimes(1);
      expect(client.cashflow.listRecurringRules.query).toHaveBeenCalledTimes(1);
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add cashflow item' }));
    await user.selectOptions(screen.getByLabelText('Direction'), 'ACTUAL_IN');
    await user.type(screen.getByLabelText('Amount'), '99000');
    await user.type(screen.getByLabelText('Date'), '2026-04-20');
    await user.click(screen.getByRole('button', { name: 'Add cashflow item' }));

    await waitFor(() => {
      expect(client.cashflow.createManualItem.mutate).toHaveBeenCalledWith({
        kind: 'ACTUAL_IN',
        amount: 99000,
        currency: 'CZK',
        date: '2026-04-20T00:00:00.000Z',
      });
    });

    expect(screen.getByText('Manual cashflow item')).toBeInTheDocument();
    expect(screen.getByText('Manual item')).toBeInTheDocument();
  });

  it('creates a recurring cashflow rule locally', async () => {
    const client = createClient();
    client.cashflow.list.query.mockResolvedValue([]);
    client.cashflow.listRecurringRules.query.mockResolvedValue([]);
    client.cashflow.createRecurringRule.mutate.mockResolvedValue({
      id: 'rule-2',
      tenantId: 'tenant-a',
      label: 'Membership',
      amount: 99000,
      currency: 'CZK',
      interval: 'MONTHLY',
      startDate: '2026-04-20T00:00:00.000Z',
      nextRunAt: '2026-04-20T00:00:00.000Z',
      note: 'Monthly membership',
      status: 'ACTIVE',
      version: 1,
    });

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;
    createTrpcClientMock.mockImplementation(() => client as never);

    render(<CashflowPage />);

    await waitFor(() => {
      expect(client.cashflow.list.query).toHaveBeenCalledTimes(1);
      expect(client.cashflow.listRecurringRules.query).toHaveBeenCalledTimes(1);
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add recurring item' }));
    await user.type(screen.getByLabelText('Label'), 'Membership');
    await user.type(screen.getByLabelText('Amount'), '99000');
    await user.type(screen.getByLabelText('Start date'), '2026-04-20');
    await user.type(screen.getByLabelText('Note'), 'Monthly membership');
    await user.click(screen.getByRole('button', { name: 'Add recurring item' }));

    await waitFor(() => {
      expect(client.cashflow.createRecurringRule.mutate).toHaveBeenCalledWith({
        label: 'Membership',
        amount: 99000,
        currency: 'CZK',
        interval: 'MONTHLY',
        startDate: '2026-04-20T00:00:00.000Z',
        note: 'Monthly membership',
      });
    });

    expect(screen.getByText('Membership')).toBeInTheDocument();
  });

  it('edits an existing recurring rule locally', async () => {
    const client = createClient();
    client.cashflow.list.query.mockResolvedValue([]);
    client.cashflow.listRecurringRules.query.mockResolvedValue([
      {
        id: 'rule-1',
        tenantId: 'tenant-a',
        label: 'Studio rent',
        amount: 450000,
        currency: 'CZK',
        interval: 'MONTHLY',
        startDate: '2026-04-01T00:00:00.000Z',
        nextRunAt: '2026-04-01T00:00:00.000Z',
        note: 'Recurring rent',
        status: 'ACTIVE',
        version: 1,
      },
    ]);
    client.cashflow.updateRecurringRule.mutate.mockResolvedValue({
      id: 'rule-1',
      tenantId: 'tenant-a',
      label: 'Studio rent updated',
      amount: 470000,
      currency: 'CZK',
      interval: 'MONTHLY',
      startDate: '2026-04-05T00:00:00.000Z',
      nextRunAt: '2026-04-05T00:00:00.000Z',
      note: 'Updated note',
      status: 'ACTIVE',
      version: 2,
    });

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;
    createTrpcClientMock.mockImplementation(() => client as never);

    render(<CashflowPage />);

    await waitFor(() => {
      expect(screen.getByText('Studio rent')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit recurring item' }));
    await user.clear(screen.getByLabelText('Label'));
    await user.type(screen.getByLabelText('Label'), 'Studio rent updated');
    await user.clear(screen.getByLabelText('Amount'));
    await user.type(screen.getByLabelText('Amount'), '470000');
    await user.clear(screen.getByLabelText('Start date'));
    await user.type(screen.getByLabelText('Start date'), '2026-04-05');
    await user.clear(screen.getByLabelText('Note'));
    await user.type(screen.getByLabelText('Note'), 'Updated note');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(client.cashflow.updateRecurringRule.mutate).toHaveBeenCalledWith({
        id: 'rule-1',
        version: 1,
        label: 'Studio rent updated',
        amount: 470000,
        currency: 'CZK',
        startDate: '2026-04-05T00:00:00.000Z',
        note: 'Updated note',
      });
    });

    expect(screen.getByText('Studio rent updated')).toBeInTheDocument();
  });

  it('runs pause resume and stop actions for recurring rules', async () => {
    const client = createClient();
    client.cashflow.list.query.mockResolvedValue([]);
    client.cashflow.listRecurringRules.query.mockResolvedValue([
      {
        id: 'rule-1',
        tenantId: 'tenant-a',
        label: 'Studio rent',
        amount: 450000,
        currency: 'CZK',
        interval: 'MONTHLY',
        startDate: '2026-04-01T00:00:00.000Z',
        nextRunAt: '2026-04-01T00:00:00.000Z',
        note: 'Recurring rent',
        status: 'ACTIVE',
        version: 1,
      },
    ]);
    client.cashflow.pauseRecurringRule.mutate.mockResolvedValue({
      id: 'rule-1', tenantId: 'tenant-a', label: 'Studio rent', amount: 450000, currency: 'CZK', interval: 'MONTHLY', startDate: '2026-04-01T00:00:00.000Z', nextRunAt: '2026-04-01T00:00:00.000Z', note: 'Recurring rent', status: 'PAUSED', version: 2,
    });
    client.cashflow.resumeRecurringRule.mutate.mockResolvedValue({
      id: 'rule-1', tenantId: 'tenant-a', label: 'Studio rent', amount: 450000, currency: 'CZK', interval: 'MONTHLY', startDate: '2026-04-01T00:00:00.000Z', nextRunAt: '2026-04-01T00:00:00.000Z', note: 'Recurring rent', status: 'ACTIVE', version: 3,
    });
    client.cashflow.stopRecurringRule.mutate.mockResolvedValue({
      id: 'rule-1', tenantId: 'tenant-a', label: 'Studio rent', amount: 450000, currency: 'CZK', interval: 'MONTHLY', startDate: '2026-04-01T00:00:00.000Z', nextRunAt: '2026-04-01T00:00:00.000Z', note: 'Recurring rent', status: 'STOPPED', version: 4,
    });

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;
    createTrpcClientMock.mockImplementation(() => client as never);

    render(<CashflowPage />);

    await waitFor(() => {
      expect(screen.getByText('Studio rent')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    await waitFor(() => expect(client.cashflow.pauseRecurringRule.mutate).toHaveBeenCalledWith({ id: 'rule-1', version: 1 }));

    await user.click(screen.getByRole('button', { name: 'Resume' }));
    await waitFor(() => expect(client.cashflow.resumeRecurringRule.mutate).toHaveBeenCalledWith({ id: 'rule-1', version: 2 }));

    await user.click(screen.getByRole('button', { name: 'Stop' }));
    await waitFor(() => expect(client.cashflow.stopRecurringRule.mutate).toHaveBeenCalledWith({ id: 'rule-1', version: 3 }));

    expect(screen.getByText('STOPPED')).toBeInTheDocument();
  });

  it('shows a conflict-specific retry message when recurring rule update is out of date', async () => {
    const client = createClient();
    client.cashflow.list.query.mockResolvedValue([]);
    client.cashflow.listRecurringRules.query.mockResolvedValue([
      {
        id: 'rule-1',
        tenantId: 'tenant-a',
        label: 'Studio rent',
        amount: 450000,
        currency: 'CZK',
        interval: 'MONTHLY',
        startDate: '2026-04-01T00:00:00.000Z',
        nextRunAt: '2026-04-01T00:00:00.000Z',
        note: 'Recurring rent',
        status: 'ACTIVE',
        version: 1,
      },
    ]);
    client.cashflow.updateRecurringRule.mutate.mockRejectedValue({ data: { code: 'CONFLICT' } });

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;
    createTrpcClientMock.mockImplementation(() => client as never);

    render(<CashflowPage />);

    await waitFor(() => {
      expect(screen.getByText('Studio rent')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Edit recurring item' }));
    await user.clear(screen.getByLabelText('Label'));
    await user.type(screen.getByLabelText('Label'), 'Studio rent updated');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(screen.getByText('Recurring rule was out of date. Refresh and try again.')).toBeInTheDocument();
    });
  });

  it('shows a conflict-specific retry message when recurring rule action is out of date', async () => {
    const client = createClient();
    client.cashflow.list.query.mockResolvedValue([]);
    client.cashflow.listRecurringRules.query.mockResolvedValue([
      {
        id: 'rule-1',
        tenantId: 'tenant-a',
        label: 'Studio rent',
        amount: 450000,
        currency: 'CZK',
        interval: 'MONTHLY',
        startDate: '2026-04-01T00:00:00.000Z',
        nextRunAt: '2026-04-01T00:00:00.000Z',
        note: 'Recurring rent',
        status: 'ACTIVE',
        version: 1,
      },
    ]);
    client.cashflow.pauseRecurringRule.mutate.mockRejectedValue({ data: { code: 'CONFLICT' } });

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;
    createTrpcClientMock.mockImplementation(() => client as never);

    render(<CashflowPage />);

    await waitFor(() => {
      expect(screen.getByText('Studio rent')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Pause' }));

    await waitFor(() => {
      expect(screen.getByText('Recurring rule was out of date. Refresh and try again.')).toBeInTheDocument();
    });
  });

  it('removes a recurring rule locally', async () => {
    const client = createClient();
    client.cashflow.list.query.mockResolvedValue([]);
    client.cashflow.listRecurringRules.query.mockResolvedValue([
      {
        id: 'rule-remove',
        tenantId: 'tenant-a',
        label: 'Studio rent',
        amount: 450000,
        currency: 'CZK',
        interval: 'MONTHLY',
        startDate: '2026-04-01T00:00:00.000Z',
        nextRunAt: '2026-04-01T00:00:00.000Z',
        note: 'Recurring rent',
        status: 'ACTIVE',
        version: 1,
      },
    ]);
    client.cashflow.removeRecurringRule.mutate.mockResolvedValue({ id: 'rule-remove' });

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;
    createTrpcClientMock.mockImplementation(() => client as never);

    render(<CashflowPage />);

    await waitFor(() => {
      expect(screen.getByText('Studio rent')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Remove recurring item' }));

    await waitFor(() => {
      expect(client.cashflow.removeRecurringRule.mutate).toHaveBeenCalledWith({ id: 'rule-remove', version: 1 });
    });

    expect(screen.queryByText('Studio rent')).not.toBeInTheDocument();
    expect(screen.getByText('No recurring rules are available yet.')).toBeInTheDocument();
  });

  it('shows a conflict-specific retry message when recurring rule remove is out of date', async () => {
    const client = createClient();
    client.cashflow.list.query.mockResolvedValue([]);
    client.cashflow.listRecurringRules.query.mockResolvedValue([
      {
        id: 'rule-remove',
        tenantId: 'tenant-a',
        label: 'Studio rent',
        amount: 450000,
        currency: 'CZK',
        interval: 'MONTHLY',
        startDate: '2026-04-01T00:00:00.000Z',
        nextRunAt: '2026-04-01T00:00:00.000Z',
        note: 'Recurring rent',
        status: 'ACTIVE',
        version: 1,
      },
    ]);
    client.cashflow.removeRecurringRule.mutate.mockRejectedValue({ data: { code: 'CONFLICT' } });

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;
    createTrpcClientMock.mockImplementation(() => client as never);

    render(<CashflowPage />);

    await waitFor(() => {
      expect(screen.getByText('Studio rent')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Remove recurring item' }));

    await waitFor(() => {
      expect(screen.getByText('Recurring rule was out of date. Refresh and try again.')).toBeInTheDocument();
    });
  });

  it('filters the loaded list by kind', async () => {
    const client = createClient();
    client.cashflow.list.query.mockResolvedValue([
      {
        id: 'cf-1',
        tenantId: 'tenant-a',
        invoiceId: 'inv-1',
        kind: 'PLANNED_IN',
        amount: 121000,
        currency: 'CZK',
        date: '2026-04-15T00:00:00.000Z',
      },
      {
        id: 'cf-2',
        tenantId: 'tenant-a',
        invoiceId: 'inv-2',
        kind: 'ACTUAL_IN',
        amount: 60500,
        currency: 'CZK',
        date: '2026-03-20T00:00:00.000Z',
      },
    ]);
    client.cashflow.listRecurringRules.query.mockResolvedValue([]);

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;
    createTrpcClientMock.mockImplementation(() => client as never);

    render(<CashflowPage />);

    await waitFor(() => {
      expect(client.cashflow.list.query).toHaveBeenCalledTimes(1);
    });

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Kind'), 'ACTUAL_IN');

    expect(screen.queryByText('Invoice reference: inv-1')).not.toBeInTheDocument();
    expect(screen.getByText('Invoice reference: inv-2')).toBeInTheDocument();
  });

  it('shows a no-results state when filters exclude every item', async () => {
    const client = createClient();
    client.cashflow.list.query.mockResolvedValue([
      {
        id: 'cf-1',
        tenantId: 'tenant-a',
        invoiceId: 'inv-1',
        kind: 'PLANNED_IN',
        amount: 121000,
        currency: 'CZK',
        date: '2026-06-30T00:00:00.000Z',
      },
    ]);
    client.cashflow.listRecurringRules.query.mockResolvedValue([]);

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-01T10:00:00.000Z').getTime());
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;
    createTrpcClientMock.mockImplementation(() => client as never);

    render(<CashflowPage />);

    await waitFor(() => {
      expect(client.cashflow.list.query).toHaveBeenCalledTimes(1);
    });

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Time horizon'), 'NEXT_30_DAYS');

    expect(screen.getByText('No cashflow items match the current filters.')).toBeInTheDocument();
  });

  it('shows explicit empty and error states from the current route data load', async () => {
    const emptyClient = createClient();
    emptyClient.cashflow.list.query.mockResolvedValue([]);
    emptyClient.cashflow.listRecurringRules.query.mockResolvedValue([]);
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');
    createTrpcClientMock.mockImplementationOnce(() => emptyClient as never);
    const { unmount } = render(<CashflowPage />);

    await waitFor(() => {
      expect(screen.getByText('No cashflow items are available yet.')).toBeInTheDocument();
    });

    expect(emptyClient.cashflow.list.query).toHaveBeenCalledTimes(1);
    expect(emptyClient.cashflow.listRecurringRules.query).toHaveBeenCalledTimes(1);
    expect(screen.getByText('No cashflow items are available yet.')).toBeInTheDocument();
    expect(screen.getByText('No recurring rules are available yet.')).toBeInTheDocument();

    unmount();

    const errorClient = createClient();
    errorClient.cashflow.list.query.mockRejectedValue(new Error('load failed'));
    errorClient.cashflow.listRecurringRules.query.mockRejectedValue(new Error('load failed'));
    createTrpcClientMock.mockImplementationOnce(() => errorClient as never);
    render(<CashflowPage />);

    await waitFor(() => {
      expect(screen.getByText('Cashflow could not be loaded right now.')).toBeInTheDocument();
    });

    expect(screen.getByText('Cashflow could not be loaded right now.')).toBeInTheDocument();
    expect(screen.getByText('Recurring rules could not be loaded right now.')).toBeInTheDocument();
  });
});
