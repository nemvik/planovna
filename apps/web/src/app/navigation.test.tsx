import { render, screen, waitFor } from '@testing-library/react';
import Dashboard, { HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY } from './page';
import BoardPage from './board/page';
import CashflowPage from './cashflow/page';
import InvoicesPage from './invoices/page';
import OrdersPage from './orders/page';
import AppNav from './app-nav';
import { createTrpcClient } from '../lib/trpc/client';
import { usePathname } from 'next/navigation';

jest.mock('../lib/trpc/client', () => ({
  createTrpcClient: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
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
    expect(screen.getAllByRole('link', { name: 'Open orders' })[0]).toHaveAttribute('href', '/orders');
    expect(screen.getAllByRole('link', { name: 'Open board' })[0]).toHaveAttribute('href', '/board');
    expect(screen.getAllByRole('link', { name: 'Open invoices' })[0]).toHaveAttribute('href', '/invoices');
    expect(screen.getAllByRole('link', { name: 'Open cashflow' })[0]).toHaveAttribute('href', '/cashflow');
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

  it('orders primary nav by product flow and marks the active route', () => {
    const usePathnameMock = usePathname as jest.Mock;
    usePathnameMock.mockReturnValue('/invoices');

    render(<AppNav />);

    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Dashboard',
      'Orders',
      'Board',
      'Invoices',
      'Cashflow',
    ]);
    expect(screen.getByRole('link', { name: 'Invoices' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Orders' })).not.toHaveAttribute('aria-current');
  });

  it('mounts the board route as the full shared workspace entry', () => {
    render(<BoardPage />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });
});
