import { render, screen, waitFor, within } from '@testing-library/react';
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
  operation: {
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

describe('homepage operations board', () => {
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

  it('shows operation loading state', async () => {
    const client = createClient();
    const deferred = createDeferred<unknown[]>();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query.mockReturnValue(deferred.promise);

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load operations' }));

    expect(screen.getAllByText('Loading operations…').length).toBeGreaterThan(0);

    deferred.resolve([]);
    await waitFor(() => {
      expect(screen.getByText('No operations found.')).toBeInTheDocument();
    });
  });

  it('shows operation empty state', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query.mockResolvedValue([]);

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load operations' }));

    expect(await screen.findByText('No operations found.')).toBeInTheDocument();
  });

  it('renders grouped board buckets with sorted operations', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query.mockResolvedValue([
      {
        id: 'op-3',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-300',
        title: 'Later bucket item',
        status: 'READY',
        startDate: '2026-03-07T08:00:00.000Z',
        sortIndex: 3,
        version: 1,
      },
      {
        id: 'op-2',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-200',
        title: 'Backlog item',
        status: 'BLOCKED',
        sortIndex: 2,
        blockedReason: 'Waiting for material',
        version: 1,
      },
      {
        id: 'op-1',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-150',
        title: 'First dated item',
        status: 'IN_PROGRESS',
        startDate: '2026-03-06T12:00:00.000Z',
        sortIndex: 1,
        version: 1,
      },
      {
        id: 'op-4',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-100',
        title: 'Same bucket lower sort index',
        status: 'READY',
        startDate: '2026-03-06T08:00:00.000Z',
        sortIndex: 0,
        version: 1,
      },
    ]);

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load operations' }));

    const backlogBucket = await screen.findByRole('region', { name: 'Backlog' });
    const firstDateBucket = screen.getByRole('region', { name: '2026-03-06' });
    const secondDateBucket = screen.getByRole('region', { name: '2026-03-07' });

    expect(within(backlogBucket).getByText('OP-200 — Backlog item')).toBeInTheDocument();
    expect(within(backlogBucket).getByText('Blocked: Waiting for material')).toBeInTheDocument();

    const firstDateItems = within(firstDateBucket).getAllByRole('listitem');
    expect(firstDateItems[0]).toHaveTextContent('OP-100 — Same bucket lower sort index');
    expect(firstDateItems[1]).toHaveTextContent('OP-150 — First dated item');

    expect(within(secondDateBucket).getByText('OP-300 — Later bucket item')).toBeInTheDocument();
  });

  it('shows operation forbidden state for planner role', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-planner' });
    client.operation.list.query.mockRejectedValue({ data: { code: 'FORBIDDEN' } });

    renderWithClient(client);
    await login('planner@tenant-a.local', 'tenant-a-pass');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load operations' }));

    expect(
      await screen.findByText('Forbidden: your role is not allowed to view operations.'),
    ).toBeInTheDocument();
  });

  it('shows operation error state', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query.mockRejectedValue(new Error('boom'));

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load operations' }));

    expect(await screen.findByText('Failed to load operations.')).toBeInTheDocument();
  });
});
