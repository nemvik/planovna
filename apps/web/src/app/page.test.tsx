import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    update: {
      mutate: jest.fn(),
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
  window.history.replaceState({}, '', '/');
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

  it('moves an operation into another loaded bucket using operation.update', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query.mockResolvedValue([
      {
        id: 'op-1',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-100',
        title: 'Backlog item',
        status: 'READY',
        sortIndex: 0,
        version: 1,
      },
      {
        id: 'op-2',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-200',
        title: 'Dated item',
        status: 'READY',
        startDate: '2026-03-06T08:00:00.000Z',
        sortIndex: 1,
        version: 1,
      },
    ]);
    client.operation.update.mutate.mockResolvedValue({
      id: 'op-1',
      tenantId: 'tenant-a',
      orderId: 'ord-1',
      code: 'OP-100',
      title: 'Backlog item',
      status: 'READY',
      startDate: '2026-03-06T00:00:00.000Z',
      sortIndex: 0,
      version: 2,
    });

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load operations' }));

    const backlogBucket = await screen.findByRole('region', { name: 'Backlog' });
    const operationCard = within(backlogBucket)
      .getByText('OP-100 — Backlog item')
      .closest('li');

    expect(operationCard).not.toBeNull();

    await user.selectOptions(within(operationCard as HTMLElement).getByLabelText('Move to bucket'), '2026-03-06');

    expect(client.operation.update.mutate).toHaveBeenCalledWith({
      id: 'op-1',
      tenantId: 'tenant-a',
      version: 1,
      startDate: '2026-03-06T00:00:00.000Z',
    });

    await waitFor(() => {
      const dateBucket = screen.getByRole('region', { name: '2026-03-06' });
      expect(within(dateBucket).getByText('OP-100 — Backlog item')).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Backlog' })).not.toBeInTheDocument();
    });
  });

  it('schedules an operation into a newly selected date bucket using operation.update', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query.mockResolvedValue([
      {
        id: 'op-1',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-100',
        title: 'Backlog item',
        status: 'READY',
        sortIndex: 0,
        version: 1,
      },
      {
        id: 'op-2',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-200',
        title: 'Loaded dated item',
        status: 'READY',
        startDate: '2026-03-06T08:00:00.000Z',
        sortIndex: 1,
        version: 1,
      },
    ]);
    client.operation.update.mutate.mockResolvedValue({
      id: 'op-1',
      tenantId: 'tenant-a',
      orderId: 'ord-1',
      code: 'OP-100',
      title: 'Backlog item',
      status: 'READY',
      startDate: '2026-03-08T00:00:00.000Z',
      sortIndex: 0,
      version: 2,
    });

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load operations' }));

    const backlogBucket = await screen.findByRole('region', { name: 'Backlog' });
    const operationCard = within(backlogBucket)
      .getByText('OP-100 — Backlog item')
      .closest('li');

    expect(operationCard).not.toBeNull();

    fireEvent.change(within(operationCard as HTMLElement).getByLabelText('Schedule to date'), {
      target: { value: '2026-03-08' },
    });
    await user.click(within(operationCard as HTMLElement).getByRole('button', { name: 'Schedule' }));

    expect(client.operation.update.mutate).toHaveBeenCalledWith({
      id: 'op-1',
      tenantId: 'tenant-a',
      version: 1,
      startDate: '2026-03-08T00:00:00.000Z',
    });

    await waitFor(() => {
      const dateBucket = screen.getByRole('region', { name: '2026-03-08' });
      expect(within(dateBucket).getByText('OP-100 — Backlog item')).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Backlog' })).not.toBeInTheDocument();
    });
  });

  it('keeps move-to-bucket options while enabling schedule only after choosing a different explicit date', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query.mockResolvedValue([
      {
        id: 'op-1',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-100',
        title: 'Loaded dated item',
        status: 'READY',
        startDate: '2026-03-06T08:00:00.000Z',
        sortIndex: 0,
        version: 1,
      },
      {
        id: 'op-2',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-200',
        title: 'Another loaded date',
        status: 'READY',
        startDate: '2026-03-07T08:00:00.000Z',
        sortIndex: 1,
        version: 1,
      },
    ]);

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load operations' }));

    const dateBucket = await screen.findByRole('region', { name: '2026-03-06' });
    const operationCard = within(dateBucket)
      .getByText('OP-100 — Loaded dated item')
      .closest('li');

    expect(operationCard).not.toBeNull();

    const moveSelect = within(operationCard as HTMLElement).getByLabelText('Move to bucket');
    expect(within(moveSelect).getAllByRole('option').map((option) => option.textContent)).toEqual([
      '2026-03-06',
      '2026-03-07',
    ]);

    const scheduleInput = within(operationCard as HTMLElement).getByLabelText('Schedule to date');
    const scheduleButton = within(operationCard as HTMLElement).getByRole('button', { name: 'Schedule' });

    expect(scheduleInput).toHaveValue('2026-03-06');
    expect(scheduleButton).toBeDisabled();

    fireEvent.change(scheduleInput, { target: { value: '2026-03-08' } });

    expect(scheduleButton).toBeEnabled();
  });

  it('reloads operations once and shows a resync message on version conflict', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query
      .mockResolvedValueOnce([
        {
          id: 'op-1',
          tenantId: 'tenant-a',
          orderId: 'ord-1',
          code: 'OP-100',
          title: 'Backlog item',
          status: 'READY',
          sortIndex: 0,
          version: 1,
        },
        {
          id: 'op-2',
          tenantId: 'tenant-a',
          orderId: 'ord-1',
          code: 'OP-200',
          title: 'Dated item',
          status: 'READY',
          startDate: '2026-03-06T08:00:00.000Z',
          sortIndex: 1,
          version: 1,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'op-1',
          tenantId: 'tenant-a',
          orderId: 'ord-1',
          code: 'OP-100',
          title: 'Backlog item',
          status: 'READY',
          startDate: '2026-03-06T00:00:00.000Z',
          sortIndex: 0,
          version: 2,
        },
        {
          id: 'op-2',
          tenantId: 'tenant-a',
          orderId: 'ord-1',
          code: 'OP-200',
          title: 'Dated item',
          status: 'READY',
          startDate: '2026-03-06T08:00:00.000Z',
          sortIndex: 1,
          version: 1,
        },
      ]);
    client.operation.update.mutate.mockRejectedValue({
      data: {
        code: 'CONFLICT',
        conflict: {
          code: 'VERSION_CONFLICT',
          entity: 'Operation',
          id: 'op-1',
          expectedVersion: 1,
          actualVersion: 2,
        },
      },
    });

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load operations' }));

    const backlogBucket = await screen.findByRole('region', { name: 'Backlog' });
    const operationCard = within(backlogBucket)
      .getByText('OP-100 — Backlog item')
      .closest('li');

    expect(operationCard).not.toBeNull();

    await user.selectOptions(within(operationCard as HTMLElement).getByLabelText('Move to bucket'), '2026-03-06');

    expect(
      await screen.findByText('Board was out of date. Reloaded latest operations, please try again.'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(client.operation.list.query).toHaveBeenCalledTimes(2);
      const dateBucket = screen.getByRole('region', { name: '2026-03-06' });
      expect(within(dateBucket).getByText('OP-100 — Backlog item')).toBeInTheDocument();
    });
  });

  it('filters loaded operations by status and date bucket and persists the selection in the URL', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query.mockResolvedValue([
      {
        id: 'op-1',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-100',
        title: 'Ready backlog item',
        status: 'READY',
        sortIndex: 0,
        version: 1,
      },
      {
        id: 'op-2',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-200',
        title: 'Done dated item',
        status: 'DONE',
        startDate: '2026-03-06T08:00:00.000Z',
        sortIndex: 1,
        version: 1,
      },
      {
        id: 'op-3',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-300',
        title: 'Done later item',
        status: 'DONE',
        startDate: '2026-03-07T08:00:00.000Z',
        sortIndex: 2,
        version: 1,
      },
    ]);

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load operations' }));

    const statusSelect = await screen.findByLabelText('Status');
    const bucketSelect = screen.getByLabelText('Date bucket');

    expect(statusSelect).toHaveValue('ALL');
    expect(bucketSelect).toHaveValue('ALL');
    expect(within(bucketSelect).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'All',
      'Backlog',
      '2026-03-06',
      '2026-03-07',
    ]);

    await user.selectOptions(statusSelect, 'DONE');
    await user.selectOptions(bucketSelect, '2026-03-06');

    expect(screen.queryByText('OP-100 — Ready backlog item')).not.toBeInTheDocument();
    expect(screen.getByText('OP-200 — Done dated item')).toBeInTheDocument();
    expect(screen.queryByText('OP-300 — Done later item')).not.toBeInTheDocument();
    expect(window.location.search).toBe('?status=DONE&bucket=2026-03-06');
  });

  it('hydrates the initial status and bucket filters from URL search params', async () => {
    window.history.replaceState({}, '', '/?status=BLOCKED&bucket=Backlog');

    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query.mockResolvedValue([
      {
        id: 'op-1',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-100',
        title: 'Blocked backlog item',
        status: 'BLOCKED',
        sortIndex: 0,
        version: 1,
      },
      {
        id: 'op-2',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-200',
        title: 'Blocked dated item',
        status: 'BLOCKED',
        startDate: '2026-03-06T08:00:00.000Z',
        sortIndex: 1,
        version: 1,
      },
      {
        id: 'op-3',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-300',
        title: 'Ready backlog item',
        status: 'READY',
        sortIndex: 2,
        version: 1,
      },
    ]);

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load operations' }));

    expect(await screen.findByLabelText('Status')).toHaveValue('BLOCKED');
    expect(screen.getByLabelText('Date bucket')).toHaveValue('Backlog');
    expect(screen.getByText('OP-100 — Blocked backlog item')).toBeInTheDocument();
    expect(screen.queryByText('OP-200 — Blocked dated item')).not.toBeInTheDocument();
    expect(screen.queryByText('OP-300 — Ready backlog item')).not.toBeInTheDocument();
  });

  it('resets a hydrated bucket filter to All when that bucket is not loaded', async () => {
    window.history.replaceState({}, '', '/?status=DONE&bucket=2026-03-08');

    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query.mockResolvedValue([
      {
        id: 'op-1',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-100',
        title: 'Done backlog item',
        status: 'DONE',
        sortIndex: 0,
        version: 1,
      },
      {
        id: 'op-2',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-200',
        title: 'Done loaded bucket item',
        status: 'DONE',
        startDate: '2026-03-06T08:00:00.000Z',
        sortIndex: 1,
        version: 1,
      },
      {
        id: 'op-3',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-300',
        title: 'Ready loaded bucket item',
        status: 'READY',
        startDate: '2026-03-07T08:00:00.000Z',
        sortIndex: 2,
        version: 1,
      },
    ]);

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load operations' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Status')).toHaveValue('DONE');
      expect(screen.getByLabelText('Date bucket')).toHaveValue('ALL');
      expect(window.location.search).toBe('?status=DONE');
    });

    expect(screen.getByText('OP-100 — Done backlog item')).toBeInTheDocument();
    expect(screen.getByText('OP-200 — Done loaded bucket item')).toBeInTheDocument();
    expect(screen.queryByText('OP-300 — Ready loaded bucket item')).not.toBeInTheDocument();
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
