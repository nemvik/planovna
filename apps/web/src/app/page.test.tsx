import { render, screen, waitFor } from '@testing-library/react';
import Dashboard, { HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY } from './page';

describe('homepage dashboard IA split', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows a public landing page on the homepage before authentication', () => {
    render(<Dashboard />);

    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(screen.getByText('Planning and finance flow for small production and operations teams.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Register and start' })[0]).toHaveAttribute('href', '/board');
    expect(screen.getAllByRole('link', { name: 'Login' })[0]).toHaveAttribute('href', '/board');
    expect(screen.getByText('Orders')).toBeInTheDocument();
    expect(screen.getByText('Board')).toBeInTheDocument();
    expect(screen.getByText('Invoices')).toBeInTheDocument();
    expect(screen.getByText('Cashflow')).toBeInTheDocument();
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
  });

  it('shows a lightweight dashboard with module links after authentication', async () => {
    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    });

    expect(screen.getAllByRole('link', { name: 'Open orders' })[0]).toHaveAttribute('href', '/orders');
    expect(screen.getAllByRole('link', { name: 'Open board' })[0]).toHaveAttribute('href', '/board');
    expect(screen.getAllByRole('link', { name: 'Open invoices' })[0]).toHaveAttribute('href', '/invoices');
    expect(screen.getAllByRole('link', { name: 'Open cashflow' })[0]).toHaveAttribute('href', '/cashflow');
    expect(screen.getByText('Move through the product in a simple flow: Orders, then Board, then Invoices, then Cashflow.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    expect(screen.queryByText('Operations board')).not.toBeInTheDocument();
    expect(screen.queryByText('Planning and finance flow for small production and operations teams.')).not.toBeInTheDocument();
  });
});
