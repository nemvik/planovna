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
    expect(await screen.findByRole('region', { name: 'Invoice list' })).toHaveTextContent('2026-0001');
    expect(screen.getByRole('region', { name: 'Invoice list' })).toHaveTextContent('121');
    expect(screen.getByRole('region', { name: 'Invoice list' })).toHaveTextContent('2026-03-15');
    expect(screen.getByRole('link', { name: 'Export PDF for 2026-0001' })).toHaveAttribute(
      'href',
      '/invoices/inv-1/pdf',
    );
    expect(screen.getByTestId('homepage-shell')).toBeInTheDocument();
  });
});
