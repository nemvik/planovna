import { render, screen } from '@testing-library/react';
import InvoicesPage from './page';
import { createTrpcClient } from '../../lib/trpc/client';

jest.mock('../../lib/trpc/client', () => ({
  createTrpcClient: jest.fn(),
}));

jest.mock('../page', () => ({
  __esModule: true,
  default: function MockHome() {
    return <div data-testid="homepage-shell">homepage shell</div>;
  },
}));

describe('invoices page', () => {
  beforeEach(() => {
    window.localStorage.clear();
    (createTrpcClient as jest.Mock).mockReset();
  });

  it('exposes a dedicated invoice view entrypoint', async () => {
    window.localStorage.setItem('planovna.homepage.accessToken', 'token-owner');
    (createTrpcClient as jest.Mock).mockReturnValue({
      invoice: {
        list: {
          query: jest.fn().mockResolvedValue([
            {
              id: 'inv-1',
              number: '2026-0001',
              status: 'ISSUED',
              amountGross: 121000,
              currency: 'CZK',
              dueAt: '2026-03-15T00:00:00.000Z',
              pdfPath: '/invoices/inv-1/pdf',
            },
            {
              id: 'inv-2',
              number: '2026-0002',
              status: 'PAID',
              amountGross: 50000,
              currency: 'CZK',
              dueAt: '2026-03-10T00:00:00.000Z',
              pdfPath: '/invoices/inv-2/pdf',
            },
          ]),
        },
      },
    });

    render(<InvoicesPage />);

    expect(screen.getByRole('heading', { name: 'Invoices' })).toBeInTheDocument();
    expect(
      screen.getByText('Dedicated invoice view built on the same shipped homepage finance and export contract.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Invoice export actions' })).toHaveTextContent(
      '/invoices/<invoiceId>/pdf',
    );
    expect(screen.getByRole('link', { name: 'Open homepage finance workspace' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Open cashflow page' })).toHaveAttribute('href', '/cashflow');
    expect(await screen.findByRole('region', { name: 'Invoice status summary' })).toHaveTextContent('Total invoices');
    expect(screen.getByRole('region', { name: 'Invoice status summary' })).toHaveTextContent('2');
    expect(screen.getByRole('region', { name: 'Invoice status summary' })).toHaveTextContent('Issued');
    expect(screen.getByRole('region', { name: 'Invoice status summary' })).toHaveTextContent('1');
    expect(screen.getByRole('region', { name: 'Invoice status summary' })).toHaveTextContent('Paid');
    expect(await screen.findByRole('region', { name: 'Invoice list' })).toHaveTextContent('2026-0001');
    expect(screen.getByRole('region', { name: 'Invoice list' })).toHaveTextContent('121');
    expect(screen.getByRole('region', { name: 'Invoice list' })).toHaveTextContent('03/15/2026');
    expect(screen.getByRole('region', { name: 'Invoice list' })).toHaveTextContent('Issued');
    expect(screen.getByRole('region', { name: 'Invoice list' })).toHaveTextContent('Paid');
    expect(screen.getByRole('region', { name: 'Invoice list' })).not.toHaveTextContent('ISSUED');
    expect(screen.getByRole('region', { name: 'Invoice list' })).not.toHaveTextContent('PAID');
    expect(screen.getByRole('link', { name: 'Export PDF for 2026-0001' })).toHaveAttribute(
      'href',
      '/invoices/inv-1/pdf',
    );
    expect(screen.getByTestId('homepage-shell')).toBeInTheDocument();
  });

  it('shows localized invalid due date fallback instead of raw token', async () => {
    window.localStorage.setItem('planovna.homepage.accessToken', 'token-owner');
    (createTrpcClient as jest.Mock).mockReturnValue({
      invoice: {
        list: {
          query: jest.fn().mockResolvedValue([
            {
              id: 'inv-3',
              number: '2026-0003',
              status: 'DRAFT',
              amountGross: 1000,
              currency: 'CZK',
              dueAt: 'not-a-date',
              pdfPath: '/invoices/inv-3/pdf',
            },
          ]),
        },
      },
    });

    render(<InvoicesPage />);

    expect(await screen.findByRole('region', { name: 'Invoice list' })).toHaveTextContent('Invalid due date');
    expect(screen.getByRole('region', { name: 'Invoice list' })).not.toHaveTextContent('not-a-date');
  });
});
