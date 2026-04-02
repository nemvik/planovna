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

    expect(screen.getByRole('link', { name: 'Continue in Board' })).toHaveAttribute('href', '/board');
    expect(screen.getByRole('link', { name: 'Open Invoices' })).toHaveAttribute('href', '/invoices');
    expect(screen.getByRole('link', { name: 'Open Cashflow' })).toHaveAttribute('href', '/cashflow');
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    expect(screen.queryByText('Operations board')).not.toBeInTheDocument();
  });
});
