import { render, screen } from '@testing-library/react';
import InvoicesPage from './page';

jest.mock('../page', () => ({
  __esModule: true,
  default: function MockHome() {
    return <div data-testid="homepage-shell">homepage shell</div>;
  },
}));

describe('invoices page', () => {
  it('exposes a dedicated invoice view entrypoint', () => {
    render(<InvoicesPage />);

    expect(screen.getByRole('heading', { name: 'Invoices' })).toBeInTheDocument();
    expect(
      screen.getByText('Dedicated invoice view built on the same shipped homepage finance and export contract.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Invoice export actions' })).toHaveTextContent(
      '/invoices/<invoiceId>/pdf',
    );
    expect(screen.getByRole('link', { name: 'Open homepage finance workspace' })).toHaveAttribute('href', '/');
    expect(screen.getByTestId('homepage-shell')).toBeInTheDocument();
  });
});
