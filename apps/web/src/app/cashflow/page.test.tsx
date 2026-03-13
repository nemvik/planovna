import { render, screen } from '@testing-library/react';
import CashflowPage from './page';

jest.mock('../page', () => ({
  __esModule: true,
  default: function MockHome() {
    return <div data-testid="homepage-shell">homepage shell</div>;
  },
}));

describe('cashflow page', () => {
  it('exposes a dedicated cashflow view entrypoint', () => {
    render(<CashflowPage />);

    expect(screen.getByRole('heading', { name: 'Cashflow' })).toBeInTheDocument();
    expect(
      screen.getByText('Dedicated cashflow view built on the same shipped homepage snapshot contract.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('homepage-shell')).toBeInTheDocument();
  });
});
