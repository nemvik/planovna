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
    expect(screen.getByTestId('homepage-shell')).toBeInTheDocument();
  });
});
