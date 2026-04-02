import { render, screen } from '@testing-library/react';
import Dashboard, { HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY } from './page';
import BoardPage from './board/page';
import CashflowPage from './cashflow/page';
import InvoicesPage from './invoices/page';

describe('homepage IA split and module pages', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows the lightweight dashboard after login', () => {
    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');
    render(<Dashboard />);

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue in Board' })).toHaveAttribute('href', '/board');
    expect(screen.getByRole('link', { name: 'Open invoices' })).toHaveAttribute('href', '/invoices');
    expect(screen.getByRole('link', { name: 'Open cashflow' })).toHaveAttribute('href', '/cashflow');
  });

  it('keeps dedicated page titles for the module routes', () => {
    render(<InvoicesPage />);
    expect(screen.getByRole('heading', { name: 'Invoices' })).toBeInTheDocument();

    render(<CashflowPage />);
    expect(screen.getByRole('heading', { name: 'Cashflow' })).toBeInTheDocument();
  });

  it('mounts the board route as the full shared workspace entry', () => {
    render(<BoardPage />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });
});
