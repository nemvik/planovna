import { render, screen, waitFor } from '@testing-library/react';
import InvoiceDetailPage from './page';
import { createTrpcClient } from '../../../lib/trpc/client';
import { HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY } from '../../home-workspace';

jest.mock('../../../lib/trpc/client', () => ({
  createTrpcClient: jest.fn(),
}));

const createAccessToken = (tenantId = 'tenant-owner') => {
  const payload = window.btoa(JSON.stringify({ tenantId })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `${payload}.signature`;
};

const createClient = () => ({
  invoice: {
    getById: { query: jest.fn() },
  },
});

describe('invoice detail/history slice 1', () => {
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
    render(<InvoiceDetailPage params={{ invoiceId: 'inv-7001' }} />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.queryByText('Invoice overview')).not.toBeInTheDocument();
  });

  it('renders a read-only invoice detail view from the single-invoice read contract', async () => {
    const client = createClient();
    client.invoice.getById.query.mockResolvedValue({
      id: 'inv-7001',
      number: '2026-7001',
      status: 'PAID',
      amountGross: 121000,
      currency: 'CZK',
      buyerDisplayName: 'Acme Interiors',
      issuedAt: '2026-04-01T00:00:00.000Z',
      dueAt: '2026-04-15T00:00:00.000Z',
      paidAt: '2026-04-14T00:00:00.000Z',
      pdfPath: '/invoices/inv-7001/pdf',
      version: 4,
    });

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, createAccessToken());
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;
    createTrpcClientMock.mockImplementation(() => client as never);

    render(<InvoiceDetailPage params={{ invoiceId: 'inv-7001' }} />);

    await waitFor(() => {
      expect(client.invoice.getById.query).toHaveBeenCalledWith({ invoiceId: 'inv-7001' });
    });

    expect(await screen.findByRole('heading', { name: '2026-7001' })).toBeInTheDocument();
    expect(screen.getByText('This first slice stays read-only and uses the current single-invoice read contract only.')).toBeInTheDocument();
    expect(screen.getAllByText('Acme Interiors').length).toBeGreaterThan(0);
    expect(screen.getByText('Paid 14 Apr 2026')).toBeInTheDocument();
    expect(screen.getByText(/1,210\.00/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to invoices' })).toHaveAttribute('href', '/invoices');
    expect(screen.getByRole('link', { name: 'Open PDF' })).toHaveAttribute('href', '/invoices/inv-7001/pdf');
    expect(screen.queryByRole('button', { name: 'Edit invoice' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel invoice' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark paid' })).not.toBeInTheDocument();
  });

  it('shows a truthful unavailable state when the single-invoice read fails', async () => {
    const client = createClient();
    client.invoice.getById.query.mockRejectedValue(new Error('not found'));

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, createAccessToken());
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;
    createTrpcClientMock.mockImplementation(() => client as never);

    render(<InvoiceDetailPage params={{ invoiceId: 'inv-missing' }} />);

    await waitFor(() => {
      expect(client.invoice.getById.query).toHaveBeenCalledWith({ invoiceId: 'inv-missing' });
    });

    expect(await screen.findByRole('heading', { name: 'Invoice detail' })).toBeInTheDocument();
    expect(screen.getByText('Invoice detail is not available for this invoice right now.')).toBeInTheDocument();
    expect(screen.getByText('Invoice detail is not available right now.')).toBeInTheDocument();
  });
});
