import { render, screen, waitFor } from '@testing-library/react';
import Dashboard, { HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY } from './page';

describe('homepage dashboard IA split', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows the login workspace on the homepage before authentication', () => {
    render(<Dashboard />);

    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
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
  });
});
