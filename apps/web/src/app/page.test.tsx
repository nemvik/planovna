import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Home from './page';
import { createTrpcClient } from '../lib/trpc/client';

jest.mock('../lib/trpc/client', () => ({
  createTrpcClient: jest.fn(),
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

const createClient = () => ({
  auth: {
    login: {
      mutate: jest.fn(),
    },
  },
  invoice: {
    list: {
      query: jest.fn(),
    },
  },
  cashflow: {
    list: {
      query: jest.fn(),
    },
  },
});

const renderWithClient = (client: ReturnType<typeof createClient>) => {
  const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;
  createTrpcClientMock.mockImplementation(() => client as never);
  render(<Home />);
};

const login = async (email = 'owner@tenant-a.local', password = 'tenant-a-pass') => {
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText('Email'));
  await user.type(screen.getByLabelText('Email'), email);
  await user.clear(screen.getByLabelText('Password'));
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Login' }));
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('web regression states', () => {
  it('keeps auth login UX for valid and invalid credentials', async () => {
    const client = createClient();
    client.auth.login.mutate
      .mockRejectedValueOnce(new Error('invalid'))
      .mockResolvedValueOnce({ accessToken: 'token-owner' });

    renderWithClient(client);

    await login('owner@tenant-a.local', 'bad-pass');
    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();

    await login('owner@tenant-a.local', 'tenant-a-pass');
    expect(await screen.findByText('Logged in')).toBeInTheDocument();
  });

  it('shows invoice loading state', async () => {
    const client = createClient();
    const deferred = createDeferred<unknown[]>();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.invoice.list.query.mockReturnValue(deferred.promise);

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load invoices' }));

    expect(screen.getAllByText('Loading invoices…').length).toBeGreaterThan(0);

    deferred.resolve([]);
    await waitFor(() => {
      expect(screen.getByText('No invoices found.')).toBeInTheDocument();
    });
  });

  it('shows invoice empty state', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.invoice.list.query.mockResolvedValue([]);

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load invoices' }));

    expect(await screen.findByText('No invoices found.')).toBeInTheDocument();
  });

  it('shows invoice loaded state', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.invoice.list.query.mockResolvedValue([
      {
        id: 'inv-1',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        number: '2026-0001',
        status: 'ISSUED',
        currency: 'CZK',
        amountGross: 1200,
      },
    ]);

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load invoices' }));

    expect(await screen.findByText('2026-0001 — ISSUED — 1200 CZK')).toBeInTheDocument();
  });

  it('shows invoice forbidden state for planner role', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-planner' });
    client.invoice.list.query.mockRejectedValue({ data: { code: 'FORBIDDEN' } });

    renderWithClient(client);
    await login('planner@tenant-a.local', 'tenant-a-pass');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load invoices' }));

    expect(
      await screen.findByText('Forbidden: your role is not allowed to view invoices.'),
    ).toBeInTheDocument();
  });

  it('shows invoice error state', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.invoice.list.query.mockRejectedValue(new Error('boom'));

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load invoices' }));

    expect(await screen.findByText('Failed to load invoices.')).toBeInTheDocument();
  });

  it('shows cashflow loading state', async () => {
    const client = createClient();
    const deferred = createDeferred<unknown[]>();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.cashflow.list.query.mockReturnValue(deferred.promise);

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load cashflow' }));

    expect(screen.getAllByText('Loading cashflow…').length).toBeGreaterThan(0);

    deferred.resolve([]);
    await waitFor(() => {
      expect(screen.getByText('No cashflow entries found.')).toBeInTheDocument();
    });
  });

  it('shows cashflow empty state', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.cashflow.list.query.mockResolvedValue([]);

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load cashflow' }));

    expect(await screen.findByText('No cashflow entries found.')).toBeInTheDocument();
  });

  it('shows cashflow loaded state', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.cashflow.list.query.mockResolvedValue([
      {
        id: 'cf-1',
        tenantId: 'tenant-a',
        invoiceId: 'inv-1',
        kind: 'PLANNED_IN',
        amount: 1200,
        currency: 'CZK',
        date: '2026-03-06',
      },
    ]);

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load cashflow' }));

    expect(
      await screen.findByText('PLANNED_IN — 1200 CZK — 2026-03-06'),
    ).toBeInTheDocument();
  });

  it('shows cashflow forbidden state for planner role', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-planner' });
    client.cashflow.list.query.mockRejectedValue({ data: { code: 'FORBIDDEN' } });

    renderWithClient(client);
    await login('planner@tenant-a.local', 'tenant-a-pass');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load cashflow' }));

    expect(
      await screen.findByText('Forbidden: your role is not allowed to view cashflow.'),
    ).toBeInTheDocument();
  });

  it('shows cashflow error state', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.cashflow.list.query.mockRejectedValue(new Error('boom'));

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load cashflow' }));

    expect(await screen.findByText('Failed to load cashflow.')).toBeInTheDocument();
  });
});
