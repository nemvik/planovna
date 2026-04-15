import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvoicesPage from './page';
import { createTrpcClient } from '../../lib/trpc/client';
import { HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY } from '../home-workspace';

jest.mock('../../lib/trpc/client', () => ({
  createTrpcClient: jest.fn(),
}));

const createAccessToken = (tenantId = 'tenant-owner') => {
  const payload = window.btoa(JSON.stringify({ tenantId })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `${payload}.signature`;
};

const createClient = () => ({
  invoice: {
    list: { query: jest.fn() },
    issue: { mutate: jest.fn() },
  },
});

describe('invoices workspace v1', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'atob', {
      configurable: true,
      value: (input: string) => Buffer.from(input, 'base64').toString('binary'),
    });
  });

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

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, createAccessToken());
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-03-24T10:00:00.000Z').getTime());
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;
    createTrpcClientMock.mockImplementation(() => client as never);

    render(<InvoicesPage />);

    await waitFor(() => {
      expect(client.invoice.list.query).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('heading', { name: 'Invoices' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New invoice' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open cashflow' })).toHaveAttribute('href', '/cashflow');
    expect(screen.getByText('Invoices stay list-first here, with cashflow as a separate next step.')).toBeInTheDocument();
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

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, createAccessToken());
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

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, createAccessToken());
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

  it('creates a new invoice locally and refreshes the list', async () => {
    const client = createClient();
    client.invoice.list.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'inv-created',
          number: '2026-4001',
          status: 'ISSUED',
          amountGross: 121000,
          currency: 'CZK',
          buyerDisplayName: 'Created Customer',
          dueAt: '2026-04-30T00:00:00.000Z',
          pdfPath: '/invoices/inv-created/pdf',
        },
      ]);
    client.invoice.issue.mutate.mockResolvedValue({ id: 'inv-created' });

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, createAccessToken('tenant-create'));
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;
    createTrpcClientMock.mockImplementation(() => client as never);

    render(<InvoicesPage />);

    await waitFor(() => {
      expect(client.invoice.list.query).toHaveBeenCalledTimes(1);
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New invoice' }));
    await user.type(screen.getByLabelText('Order ID'), 'order-4001');
    await user.type(screen.getByLabelText('Invoice number'), '2026-4001');
    await user.type(screen.getByLabelText('Net amount'), '100000');
    await user.clear(screen.getByLabelText('VAT rate %'));
    await user.type(screen.getByLabelText('VAT rate %'), '21');
    await user.type(screen.getByLabelText('Issued at'), '2026-04-14');
    await user.type(screen.getByLabelText('Due at'), '2026-04-30');
    await user.click(screen.getByRole('button', { name: 'Create invoice' }));

    await waitFor(() => {
      expect(client.invoice.issue.mutate).toHaveBeenCalledWith({        orderId: 'order-4001',
        number: '2026-4001',
        currency: 'CZK',
        amountNet: 100000,
        vatRatePercent: 21,
        issuedAt: '2026-04-14T00:00:00.000Z',
        dueAt: '2026-04-30T00:00:00.000Z',
      });
    });

    await waitFor(() => {
      expect(client.invoice.list.query).toHaveBeenCalledTimes(2);
    });

    expect(screen.queryByRole('heading', { name: 'New invoice' })).not.toBeInTheDocument();
    expect(screen.getByText('2026-4001')).toBeInTheDocument();
  });

  it('shows a create error when issuing fails', async () => {
    const client = createClient();
    client.invoice.list.query.mockResolvedValue([]);
    client.invoice.issue.mutate.mockRejectedValue(new Error('issue failed'));

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, createAccessToken('tenant-create'));
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;
    createTrpcClientMock.mockImplementation(() => client as never);

    render(<InvoicesPage />);

    await waitFor(() => {
      expect(client.invoice.list.query).toHaveBeenCalledTimes(1);
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New invoice' }));
    await user.type(screen.getByLabelText('Order ID'), 'order-4002');
    await user.type(screen.getByLabelText('Invoice number'), '2026-4002');
    await user.type(screen.getByLabelText('Net amount'), '100000');
    await user.click(screen.getByRole('button', { name: 'Create invoice' }));

    await waitFor(() => {
      expect(screen.getByText('Invoice could not be created right now.')).toBeInTheDocument();
    });
  });

  it('shows explicit empty and error states from the current route data load', async () => {
    const emptyClient = createClient();
    emptyClient.invoice.list.query.mockResolvedValue([]);
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, createAccessToken());
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
