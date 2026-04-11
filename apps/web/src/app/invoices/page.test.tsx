import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvoicesPage from './page';
import { createTrpcClient } from '../../lib/trpc/client';
import { HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY } from '../home-workspace';

jest.mock('../../lib/trpc/client', () => ({
  createTrpcClient: jest.fn(),
}));

const createClient = () => ({
  invoice: {
    list: { query: jest.fn() },
  },
});

describe('invoices workspace v1', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the login workspace before authentication', () => {
    render(<InvoicesPage />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Invoices' })).not.toBeInTheDocument();
  });

  it('renders the invoices workspace with metrics, filters, and detail links after loading', async () => {
    const client = createClient();
    client.invoice.list.query.mockResolvedValue([
      {
        id: 'inv-overdue',
        number: '2026-1001',
        status: 'ISSUED',
        amountGross: 121000,
        currency: 'CZK',
        buyerDisplayName: 'Acme Interiors',
        dueAt: '2026-03-20T00:00:00.000Z',
        pdfPath: '/invoices/inv-overdue/pdf',
      },
      {
        id: 'inv-paid',
        number: '2026-1002',
        status: 'PAID',
        amountGross: 60500,
        currency: 'CZK',
        buyerDisplayName: 'Beta Studio',
        dueAt: '2026-03-25T00:00:00.000Z',
        paidAt: '2026-03-24T00:00:00.000Z',
        pdfPath: '/invoices/inv-paid/pdf',
      },
      {
        id: 'inv-draft',
        number: '2026-1003',
        status: 'DRAFT',
        amountGross: 50000,
        currency: 'CZK',
        pdfPath: '/invoices/inv-draft/pdf',
      },
    ]);

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-03-24T10:00:00.000Z').getTime());
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;
    createTrpcClientMock.mockImplementation(() => client as never);

    render(<InvoicesPage />);

    await waitFor(() => {
      expect(client.invoice.list.query).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('heading', { name: 'Invoices' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open cashflow' })).toHaveAttribute('href', '/cashflow');
    expect(screen.getByText('Use cashflow when you need the next finance follow-up after invoice review.')).toBeInTheDocument();
    expect(screen.getByText('All invoices')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getAllByText('Overdue').length).toBeGreaterThan(0);
    expect(screen.getByText('Acme Interiors')).toBeInTheDocument();
    expect(screen.getByText('2026-1001')).toBeInTheDocument();
    expect(screen.getAllByText('Invoice PDF document').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Open PDF' })[0]).toHaveAttribute('href', '/invoices/inv-overdue/pdf');
  });

  it('filters the loaded list down to matching invoices only', async () => {
    const client = createClient();
    client.invoice.list.query.mockResolvedValue([
      {
        id: 'inv-a',
        number: '2026-2001',
        status: 'ISSUED',
        amountGross: 121000,
        currency: 'CZK',
        buyerDisplayName: 'Acme Interiors',
        dueAt: '2026-03-20T00:00:00.000Z',
        pdfPath: '/invoices/inv-a/pdf',
      },
      {
        id: 'inv-b',
        number: '2026-2002',
        status: 'PAID',
        amountGross: 60500,
        currency: 'CZK',
        buyerDisplayName: 'Beta Studio',
        paidAt: '2026-03-21T00:00:00.000Z',
        pdfPath: '/invoices/inv-b/pdf',
      },
    ]);

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;
    createTrpcClientMock.mockImplementation(() => client as never);

    render(<InvoicesPage />);

    await waitFor(() => {
      expect(client.invoice.list.query).toHaveBeenCalledTimes(1);
    });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Search invoices'), 'Beta');

    expect(screen.queryByText('2026-2001')).not.toBeInTheDocument();
    expect(screen.getByText('2026-2002')).toBeInTheDocument();
  });

  it('shows a no-results state when filters exclude every invoice', async () => {
    const client = createClient();
    client.invoice.list.query.mockResolvedValue([
      {
        id: 'inv-a',
        number: '2026-3001',
        status: 'PAID',
        amountGross: 60500,
        currency: 'CZK',
        buyerDisplayName: 'Beta Studio',
        paidAt: '2026-03-21T00:00:00.000Z',
        pdfPath: '/invoices/inv-a/pdf',
      },
    ]);

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;
    createTrpcClientMock.mockImplementation(() => client as never);

    render(<InvoicesPage />);

    await waitFor(() => {
      expect(client.invoice.list.query).toHaveBeenCalledTimes(1);
    });

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Filter'), 'DRAFT');

    expect(screen.getByText('No invoices match the current filters.')).toBeInTheDocument();
  });

  it('shows explicit empty and error states from the current route data load', async () => {
    const emptyClient = createClient();
    emptyClient.invoice.list.query.mockResolvedValue([]);
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');
    createTrpcClientMock.mockImplementationOnce(() => emptyClient as never);
    const { unmount } = render(<InvoicesPage />);

    await waitFor(() => {
      expect(emptyClient.invoice.list.query).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('No invoices are available yet.')).toBeInTheDocument();

    unmount();

    const errorClient = createClient();
    errorClient.invoice.list.query.mockRejectedValue(new Error('load failed'));
    createTrpcClientMock.mockImplementationOnce(() => errorClient as never);
    render(<InvoicesPage />);

    await waitFor(() => {
      expect(errorClient.invoice.list.query).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Invoices could not be loaded right now.')).toBeInTheDocument();
  });
});
