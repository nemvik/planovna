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

  it('renders the cashflow workspace with summary cards, filters, and a list after loading', async () => {
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

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-01T10:00:00.000Z').getTime());
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;
    createTrpcClientMock.mockImplementation(() => client as never);

    render(<CashflowPage />);

    await waitFor(() => {
      expect(client.cashflow.list.query).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('heading', { name: 'Cashflow' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open invoices' })).toHaveAttribute('href', '/invoices');
    expect(screen.getByText('Cashflow is the final finance step after invoice review. Use invoices when you need the source finance document behind a linked cashflow item.')).toBeInTheDocument();
    expect(screen.getByText('All items')).toBeInTheDocument();
    expect(screen.getAllByText('Invoice-linked').length).toBeGreaterThan(0);
    expect(screen.getByText('Invoice reference: inv-1')).toBeInTheDocument();
    expect(screen.getAllByText('Planned in').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Actual in').length).toBeGreaterThan(0);
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
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');
    createTrpcClientMock.mockImplementationOnce(() => emptyClient as never);
    const { unmount } = render(<CashflowPage />);

    await waitFor(() => {
      expect(emptyClient.cashflow.list.query).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('No cashflow items are available yet.')).toBeInTheDocument();

    unmount();

    const errorClient = createClient();
    errorClient.cashflow.list.query.mockRejectedValue(new Error('load failed'));
    createTrpcClientMock.mockImplementationOnce(() => errorClient as never);
    render(<CashflowPage />);

    await waitFor(() => {
      expect(errorClient.cashflow.list.query).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Cashflow could not be loaded right now.')).toBeInTheDocument();
  });
});
