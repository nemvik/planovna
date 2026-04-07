import { render, screen, waitFor } from '@testing-library/react';
import Dashboard, { HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY } from './page';
import BoardPage from './board/page';
import CashflowPage from './cashflow/page';
import InvoicesPage from './invoices/page';
import OrdersPage from './orders/page';
import { createTrpcClient } from '../lib/trpc/client';

jest.mock('../lib/trpc/client', () => ({
  createTrpcClient: jest.fn(),
}));

describe('homepage IA split and module pages', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  it('shows the lightweight dashboard after login', () => {
    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');
    render(<Dashboard />);

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue in Board' })).toHaveAttribute('href', '/board');
    expect(screen.getByRole('link', { name: 'Open invoices' })).toHaveAttribute('href', '/invoices');
    expect(screen.getByRole('link', { name: 'Open cashflow' })).toHaveAttribute('href', '/cashflow');
  });

  it('keeps dedicated page titles for the module routes', async () => {
    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');
    const client = {
      invoice: {
        list: { query: jest.fn().mockResolvedValue([]) },
      },
      cashflow: {
        list: { query: jest.fn().mockResolvedValue([]) },
      },
      order: {
        list: { query: jest.fn().mockResolvedValue([]) },
      },
    };
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;
    createTrpcClientMock.mockImplementation(() => client as never);

    render(<InvoicesPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Invoices' })).toBeInTheDocument();
    });

    render(<CashflowPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cashflow' })).toBeInTheDocument();
    });

    render(<OrdersPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Orders' })).toBeInTheDocument();
    });
  });

  it('mounts the board route as the full shared workspace entry', () => {
    render(<BoardPage />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });
});
