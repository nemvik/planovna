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
        dependencyCount: 0,
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
        dependencyCount: 2,
        prerequisiteCodes: ['OP-120', 'OP-130'],
        prerequisiteOverflowCount: 0,
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
        dependencyCount: 1,
        prerequisiteCodes: ['OP-125'],
        prerequisiteOverflowCount: 0,
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
        dependencyCount: 0,
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
    expect(within(backlogBucket).getByText('Waiting on OP-120, OP-130')).toBeInTheDocument();

    const firstDateItems = within(firstDateBucket).getAllByRole('listitem');
    expect(firstDateItems[0]).toHaveTextContent('OP-100 — Same bucket lower sort index');
    expect(firstDateItems[1]).toHaveTextContent('OP-150 — First dated item');
    expect(within(firstDateItems[1]).getByText('Waiting on OP-125')).toBeInTheDocument();
    expect(within(firstDateItems[0]).queryByText(/Waiting on /)).not.toBeInTheDocument();

    expect(within(secondDateBucket).getByText('OP-300 — Later bucket item')).toBeInTheDocument();
    expect(within(secondDateBucket).queryByText(/Waiting on /)).not.toBeInTheDocument();
  });

  it('renders a compact prerequisite overflow suffix only when more same-tenant prerequisites exist beyond the cap', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query.mockResolvedValue([
      {
        id: 'op-1',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-100',
        title: 'Overflow item',
        status: 'BLOCKED',
        sortIndex: 0,
        dependencyCount: 5,
        prerequisiteCodes: ['OP-120', 'OP-130', 'OP-140'],
        prerequisiteOverflowCount: 2,
        version: 1,
      },
    ]);

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load operations' }));

    const backlogBucket = await screen.findByRole('region', { name: 'Backlog' });
    expect(
      within(backlogBucket).getByText('Waiting on OP-120, OP-130, OP-140 +2 more'),
    ).toBeInTheDocument();
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

  it('persists a status change and updates the filtered board immediately', async () => {
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
        title: 'Blocked backlog item',
        status: 'BLOCKED',
        sortIndex: 1,
        version: 1,
      },
    ]);
    client.operation.update.mutate.mockResolvedValue({
      id: 'op-1',
      tenantId: 'tenant-a',
      orderId: 'ord-1',
      code: 'OP-100',
      title: 'Ready backlog item',
      status: 'DONE',
      sortIndex: 0,
      version: 2,
    });

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load operations' }));

    await user.selectOptions(screen.getAllByLabelText('Status')[0], 'READY');

    expect(await screen.findByText('Showing 1 of 2 operations.')).toBeInTheDocument();

    const backlogBucket = await screen.findByRole('region', { name: 'Backlog' });
    const operationCard = within(backlogBucket)
      .getByText('OP-100 — Ready backlog item')
      .closest('li');

    expect(operationCard).not.toBeNull();

    await user.selectOptions(within(operationCard as HTMLElement).getByLabelText('Status'), 'DONE');

    expect(client.operation.update.mutate).toHaveBeenCalledWith({
      id: 'op-1',
      tenantId: 'tenant-a',
      version: 1,
      status: 'DONE',
    });

    await waitFor(() => {
      expect(screen.getByText('Showing 0 of 2 operations.')).toBeInTheDocument();
      expect(screen.queryByText('OP-100 — Ready backlog item')).not.toBeInTheDocument();
    });

    expect(client.operation.list.query).toHaveBeenCalledTimes(1);

    await user.selectOptions(screen.getAllByLabelText('Status')[0], 'DONE');

    expect(await screen.findByText('Showing 1 of 2 operations.')).toBeInTheDocument();

    const updatedCard = await within(screen.getByRole('region', { name: 'Backlog' }))
      .findByText('OP-100 — Ready backlog item')
      .then((element) => element.closest('li'));

    expect(updatedCard).not.toBeNull();
    expect(within(updatedCard as HTMLElement).getByLabelText('Status')).toHaveValue('DONE');
  });

  it('shows an active-filter summary that updates counts from loaded board data without refetching', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query.mockResolvedValue([
      {
        id: 'op-1',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-100',
        title: 'Cut steel',
        status: 'READY',
        sortIndex: 0,
        version: 1,
      },
      {
        id: 'op-2',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-200',
        title: 'Paint frame',
        status: 'BLOCKED',
        sortIndex: 1,
        version: 1,
      },
      {
        id: 'op-3',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-300',
        title: 'Weld frame',
        status: 'READY',
        sortIndex: 2,
        version: 1,
      },
    ]);

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load operations' }));

    await user.selectOptions(screen.getAllByLabelText('Status')[0], 'READY');

    expect(await screen.findByText('Showing 2 of 3 operations.')).toBeInTheDocument();
    expect(screen.getByText('Status: READY')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Code or title'), 'weld');

    expect(screen.getByText('Showing 1 of 3 operations.')).toBeInTheDocument();
    expect(screen.getByText('Query: weld')).toBeInTheDocument();
    expect(screen.getByText('OP-300 — Weld frame')).toBeInTheDocument();
    expect(screen.queryByText('OP-100 — Cut steel')).not.toBeInTheDocument();
    expect(client.operation.list.query).toHaveBeenCalledTimes(1);
  });

  it('keeps the active-filter summary visible in the filtered-empty state', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query.mockResolvedValue([
      {
        id: 'op-1',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-100',
        title: 'Cut steel',
        status: 'READY',
        sortIndex: 0,
        version: 1,
      },
      {
        id: 'op-2',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-200',
        title: 'Paint frame',
        status: 'BLOCKED',
        sortIndex: 1,
        version: 1,
      },
    ]);

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load operations' }));
    await user.type(screen.getByLabelText('Code or title'), 'missing');

    expect(await screen.findByText('Showing 0 of 2 operations.')).toBeInTheDocument();
    expect(screen.getByText('Query: missing')).toBeInTheDocument();
    expect(screen.getByText('No operations match the current filters.')).toBeInTheDocument();
    expect(screen.getByText('Clear filters to return to the full board without reloading operations.')).toBeInTheDocument();
  });

  it('clears only the status chip and preserves bucket and query filters', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query.mockResolvedValue([
      {
        id: 'op-1',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-100',
        title: 'Cut steel',
        status: 'READY',
        sortIndex: 0,
        version: 1,
      },
      {
        id: 'op-2',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-200',
        title: 'Cut frame blocked',
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
        title: 'Cut frame',
        status: 'READY',
        startDate: '2026-03-06T09:00:00.000Z',
        sortIndex: 2,
        version: 1,
      },
      {
        id: 'op-4',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-400',
        title: 'Weld frame',
        status: 'READY',
        startDate: '2026-03-06T10:00:00.000Z',
        sortIndex: 3,
        version: 1,
      },
    ]);

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load operations' }));
    await user.selectOptions(screen.getAllByLabelText('Status')[0], 'READY');
    await user.selectOptions(screen.getByLabelText('Date bucket'), '2026-03-06');
    await user.type(screen.getByLabelText('Code or title'), 'frame');

    expect(await screen.findByText('Showing 2 of 4 operations.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear status filter' }));

    await waitFor(() => {
      expect(screen.getByText('Showing 3 of 4 operations.')).toBeInTheDocument();
    });

    expect(screen.getAllByLabelText('Status')[0]).toHaveValue('ALL');
    expect(screen.getByLabelText('Date bucket')).toHaveValue('2026-03-06');
    expect(screen.getByLabelText('Code or title')).toHaveValue('frame');
    expect(screen.queryByText('Status: READY')).not.toBeInTheDocument();
    expect(screen.getByText('Bucket: 2026-03-06')).toBeInTheDocument();
    expect(screen.getByText('Query: frame')).toBeInTheDocument();
    expect(screen.getByText('OP-200 — Cut frame blocked')).toBeInTheDocument();
    expect(client.operation.list.query).toHaveBeenCalledTimes(1);
  });

  it('clears only the bucket chip and preserves status and query filters', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query.mockResolvedValue([
      {
        id: 'op-1',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-100',
        title: 'Cut steel',
        status: 'READY',
        sortIndex: 0,
        version: 1,
      },
      {
        id: 'op-2',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-200',
        title: 'Cut frame blocked',
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
        title: 'Cut frame',
        status: 'READY',
        startDate: '2026-03-06T09:00:00.000Z',
        sortIndex: 2,
        version: 1,
      },
      {
        id: 'op-4',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-400',
        title: 'Weld frame',
        status: 'READY',
        startDate: '2026-03-06T10:00:00.000Z',
        sortIndex: 3,
        version: 1,
      },
    ]);

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load operations' }));
    await user.selectOptions(screen.getAllByLabelText('Status')[0], 'READY');
    await user.selectOptions(screen.getByLabelText('Date bucket'), '2026-03-06');
    await user.type(screen.getByLabelText('Code or title'), 'cut');

    expect(await screen.findByText('Showing 1 of 4 operations.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear bucket filter' }));

    await waitFor(() => {
      expect(screen.getByText('Showing 2 of 4 operations.')).toBeInTheDocument();
    });

    expect(screen.getAllByLabelText('Status')[0]).toHaveValue('READY');
    expect(screen.getByLabelText('Date bucket')).toHaveValue('ALL');
    expect(screen.getByLabelText('Code or title')).toHaveValue('cut');
    expect(screen.getByText('Status: READY')).toBeInTheDocument();
    expect(screen.queryByText('Bucket: 2026-03-06')).not.toBeInTheDocument();
    expect(screen.getByText('Query: cut')).toBeInTheDocument();
    expect(screen.getByText('OP-100 — Cut steel')).toBeInTheDocument();
    expect(screen.getByText('OP-300 — Cut frame')).toBeInTheDocument();
    expect(client.operation.list.query).toHaveBeenCalledTimes(1);
  });

  it('clears only the query chip and preserves status and bucket filters', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query.mockResolvedValue([
      {
        id: 'op-1',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-100',
        title: 'Cut steel',
        status: 'READY',
        sortIndex: 0,
        version: 1,
      },
      {
        id: 'op-2',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-200',
        title: 'Cut frame blocked',
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
        title: 'Cut frame',
        status: 'READY',
        startDate: '2026-03-06T09:00:00.000Z',
        sortIndex: 2,
        version: 1,
      },
      {
        id: 'op-4',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-400',
        title: 'Weld frame',
        status: 'READY',
        startDate: '2026-03-06T10:00:00.000Z',
        sortIndex: 3,
        version: 1,
      },
    ]);

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load operations' }));
    await user.selectOptions(screen.getAllByLabelText('Status')[0], 'READY');
    await user.selectOptions(screen.getByLabelText('Date bucket'), '2026-03-06');
    await user.type(screen.getByLabelText('Code or title'), 'cut');

    expect(await screen.findByText('Showing 1 of 4 operations.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear query filter' }));

    await waitFor(() => {
      expect(screen.getByText('Showing 2 of 4 operations.')).toBeInTheDocument();
    });

    expect(screen.getAllByLabelText('Status')[0]).toHaveValue('READY');
    expect(screen.getByLabelText('Date bucket')).toHaveValue('2026-03-06');
    expect(screen.getByLabelText('Code or title')).toHaveValue('');
    expect(screen.getByText('Status: READY')).toBeInTheDocument();
    expect(screen.getByText('Bucket: 2026-03-06')).toBeInTheDocument();
    expect(screen.queryByText('Query: cut')).not.toBeInTheDocument();
    expect(screen.getByText('OP-300 — Cut frame')).toBeInTheDocument();
    expect(screen.getByText('OP-400 — Weld frame')).toBeInTheDocument();
    expect(client.operation.list.query).toHaveBeenCalledTimes(1);
  });

  it('persists a blocked reason edit and merges the returned operation into board state', async () => {
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
        blockedReason: 'Waiting for material',
        version: 1,
      },
    ]);
    client.operation.update.mutate.mockResolvedValue({
      id: 'op-1',
      tenantId: 'tenant-a',
      orderId: 'ord-1',
      code: 'OP-100',
      title: 'Blocked backlog item',
      status: 'BLOCKED',
      sortIndex: 0,
      blockedReason: 'Vendor confirmed Friday delivery',
      version: 2,
    });

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load operations' }));

    const backlogBucket = await screen.findByRole('region', { name: 'Backlog' });
    const operationCard = within(backlogBucket)
      .getByText('OP-100 — Blocked backlog item')
      .closest('li');

    expect(operationCard).not.toBeNull();

    const blockedReasonInput = within(operationCard as HTMLElement).getByLabelText('Blocked reason');
    await user.clear(blockedReasonInput);
    await user.type(blockedReasonInput, 'Vendor confirmed Friday delivery');
    await user.click(within(operationCard as HTMLElement).getByRole('button', { name: 'Save reason' }));

    expect(client.operation.update.mutate).toHaveBeenCalledWith({
      id: 'op-1',
      tenantId: 'tenant-a',
      version: 1,
      blockedReason: 'Vendor confirmed Friday delivery',
    });

    await waitFor(() => {
      expect(within(operationCard as HTMLElement).getByDisplayValue('Vendor confirmed Friday delivery')).toBeInTheDocument();
      expect(within(operationCard as HTMLElement).getByText('Blocked: Vendor confirmed Friday delivery')).toBeInTheDocument();
    });
  });

  it('persists a title edit and merges the returned operation into board state immediately', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query.mockResolvedValue([
      {
        id: 'op-1',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-100',
        title: 'Original title',
        status: 'READY',
        sortIndex: 0,
        dependencyCount: 3,
        prerequisiteCodes: ['OP-120', 'OP-130', 'OP-140'],
        version: 1,
      },
    ]);
    client.operation.update.mutate.mockResolvedValue({
      id: 'op-1',
      tenantId: 'tenant-a',
      orderId: 'ord-1',
      code: 'OP-100',
      title: 'Updated title',
      status: 'READY',
      sortIndex: 0,
      dependencyCount: 3,
      prerequisiteCodes: ['OP-120', 'OP-130', 'OP-140'],
      version: 2,
    });

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load operations' }));

    const backlogBucket = await screen.findByRole('region', { name: 'Backlog' });
    const operationCard = within(backlogBucket)
      .getByText('OP-100 — Original title')
      .closest('li');

    expect(operationCard).not.toBeNull();

    const titleInput = within(operationCard as HTMLElement).getByLabelText('Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Updated title');
    await user.click(within(operationCard as HTMLElement).getByRole('button', { name: 'Save title' }));

    expect(client.operation.update.mutate).toHaveBeenCalledWith({
      id: 'op-1',
      tenantId: 'tenant-a',
      version: 1,
      title: 'Updated title',
    });

    await waitFor(() => {
      expect(within(operationCard as HTMLElement).getByDisplayValue('Updated title')).toBeInTheDocument();
      expect(within(operationCard as HTMLElement).getByText('OP-100 — Updated title')).toBeInTheDocument();
      expect(
        within(operationCard as HTMLElement).getByText('Waiting on OP-120, OP-130, OP-140'),
      ).toBeInTheDocument();
    });
  });

  it('persists a code edit and merges the returned operation into board state immediately', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query.mockResolvedValue([
      {
        id: 'op-1',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-100',
        title: 'Original title',
        status: 'READY',
        sortIndex: 0,
        version: 1,
      },
    ]);
    client.operation.update.mutate.mockResolvedValue({
      id: 'op-1',
      tenantId: 'tenant-a',
      orderId: 'ord-1',
      code: 'OP-101',
      title: 'Original title',
      status: 'READY',
      sortIndex: 0,
      version: 2,
    });

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load operations' }));

    const backlogBucket = await screen.findByRole('region', { name: 'Backlog' });
    const operationCard = within(backlogBucket)
      .getByText('OP-100 — Original title')
      .closest('li');

    expect(operationCard).not.toBeNull();

    const codeInput = within(operationCard as HTMLElement).getByLabelText('Code');
    await user.clear(codeInput);
    await user.type(codeInput, 'OP-101');
    await user.click(within(operationCard as HTMLElement).getByRole('button', { name: 'Save code' }));

    expect(client.operation.update.mutate).toHaveBeenCalledWith({
      id: 'op-1',
      tenantId: 'tenant-a',
      version: 1,
      code: 'OP-101',
    });

    await waitFor(() => {
      expect(within(operationCard as HTMLElement).getByDisplayValue('OP-101')).toBeInTheDocument();
      expect(within(operationCard as HTMLElement).getByText('OP-101 — Original title')).toBeInTheDocument();
    });
  });

  it('persists an end date edit and merges the returned operation into board state', async () => {
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
    ]);
    client.operation.update.mutate.mockResolvedValue({
      id: 'op-1',
      tenantId: 'tenant-a',
      orderId: 'ord-1',
      code: 'OP-100',
      title: 'Ready backlog item',
      status: 'READY',
      endDate: '2026-03-10T00:00:00.000Z',
      sortIndex: 0,
      version: 2,
    });

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load operations' }));

    const backlogBucket = await screen.findByRole('region', { name: 'Backlog' });
    const operationCard = within(backlogBucket)
      .getByText('OP-100 — Ready backlog item')
      .closest('li');

    expect(operationCard).not.toBeNull();

    fireEvent.change(within(operationCard as HTMLElement).getByLabelText('End date'), {
      target: { value: '2026-03-10' },
    });
    await user.click(within(operationCard as HTMLElement).getByRole('button', { name: 'Save end' }));

    expect(client.operation.update.mutate).toHaveBeenCalledWith({
      id: 'op-1',
      tenantId: 'tenant-a',
      version: 1,
      endDate: '2026-03-10T00:00:00.000Z',
    });

    await waitFor(() => {
      expect(within(operationCard as HTMLElement).getByLabelText('End date')).toHaveValue('2026-03-10');
    });
  });

  it('clears an existing end date inline and merges the returned operation into board state', async () => {
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
        endDate: '2026-03-10T00:00:00.000Z',
        sortIndex: 0,
        version: 1,
      },
    ]);
    client.operation.update.mutate.mockResolvedValue({
      id: 'op-1',
      tenantId: 'tenant-a',
      orderId: 'ord-1',
      code: 'OP-100',
      title: 'Ready backlog item',
      status: 'READY',
      sortIndex: 0,
      version: 2,
    });

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load operations' }));

    const backlogBucket = await screen.findByRole('region', { name: 'Backlog' });
    const operationCard = within(backlogBucket)
      .getByText('OP-100 — Ready backlog item')
      .closest('li');

    expect(operationCard).not.toBeNull();
    expect(within(operationCard as HTMLElement).getByLabelText('End date')).toHaveValue('2026-03-10');

    await user.click(within(operationCard as HTMLElement).getByRole('button', { name: 'Clear end' }));

    expect(client.operation.update.mutate).toHaveBeenCalledWith({
      id: 'op-1',
      tenantId: 'tenant-a',
      version: 1,
      endDate: null,
    });

    await waitFor(() => {
      expect(within(operationCard as HTMLElement).getByLabelText('End date')).toHaveValue('');
      expect(within(operationCard as HTMLElement).queryByRole('button', { name: 'Clear end' })).not.toBeInTheDocument();
    });
  });

  it('clears an existing blocked reason inline via explicit null update semantics', async () => {
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
        blockedReason: 'Waiting for material',
        version: 1,
      },
    ]);
    client.operation.update.mutate.mockResolvedValue({
      id: 'op-1',
      tenantId: 'tenant-a',
      orderId: 'ord-1',
      code: 'OP-100',
      title: 'Blocked backlog item',
      status: 'BLOCKED',
      sortIndex: 0,
      version: 2,
    });

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load operations' }));

    const backlogBucket = await screen.findByRole('region', { name: 'Backlog' });
    const operationCard = within(backlogBucket)
      .getByText('OP-100 — Blocked backlog item')
      .closest('li');

    expect(operationCard).not.toBeNull();
    expect(within(operationCard as HTMLElement).getByText('Blocked: Waiting for material')).toBeInTheDocument();

    await user.click(within(operationCard as HTMLElement).getByRole('button', { name: 'Clear reason' }));

    expect(client.operation.update.mutate).toHaveBeenCalledWith({
      id: 'op-1',
      tenantId: 'tenant-a',
      version: 1,
      blockedReason: null,
    });

    await waitFor(() => {
      expect(within(operationCard as HTMLElement).queryByText('Blocked: Waiting for material')).not.toBeInTheDocument();
      expect(within(operationCard as HTMLElement).getByLabelText('Blocked reason')).toHaveValue('');
      expect(within(operationCard as HTMLElement).queryByRole('button', { name: 'Clear reason' })).not.toBeInTheDocument();
    });
  });

  it('persists a sort index edit and re-sorts the bucket with the returned operation', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query.mockResolvedValue([
      {
        id: 'op-1',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-100',
        title: 'First backlog item',
        status: 'READY',
        sortIndex: 0,
        version: 1,
      },
      {
        id: 'op-2',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-200',
        title: 'Second backlog item',
        status: 'READY',
        sortIndex: 1,
        version: 1,
      },
    ]);
    client.operation.update.mutate.mockResolvedValue({
      id: 'op-2',
      tenantId: 'tenant-a',
      orderId: 'ord-1',
      code: 'OP-200',
      title: 'Second backlog item',
      status: 'READY',
      sortIndex: -1,
      version: 2,
    });

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load operations' }));

    const backlogBucket = await screen.findByRole('region', { name: 'Backlog' });
    const operationCard = within(backlogBucket)
      .getByText('OP-200 — Second backlog item')
      .closest('li');

    expect(operationCard).not.toBeNull();

    const sortIndexInput = within(operationCard as HTMLElement).getByLabelText('Sort index');
    await user.clear(sortIndexInput);
    await user.type(sortIndexInput, '-1');
    await user.click(within(operationCard as HTMLElement).getByRole('button', { name: 'Save sort' }));

    expect(client.operation.update.mutate).toHaveBeenCalledWith({
      id: 'op-2',
      tenantId: 'tenant-a',
      version: 1,
      sortIndex: -1,
    });

    await waitFor(() => {
      const refreshedBacklogBucket = screen.getByRole('region', { name: 'Backlog' });
      const backlogItems = within(refreshedBacklogBucket).getAllByRole('listitem');

      expect(backlogItems[0]).toHaveTextContent('OP-200 — Second backlog item');
      expect(backlogItems[1]).toHaveTextContent('OP-100 — First backlog item');
      expect(within(backlogItems[0]).getByLabelText('Sort index')).toHaveValue(-1);
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

  it('reloads operations and shows the resync message when a status change hits a version conflict', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query
      .mockResolvedValueOnce([
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
      ])
      .mockResolvedValueOnce([
        {
          id: 'op-1',
          tenantId: 'tenant-a',
          orderId: 'ord-1',
          code: 'OP-100',
          title: 'Ready backlog item',
          status: 'DONE',
          sortIndex: 0,
          version: 2,
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
      .getByText('OP-100 — Ready backlog item')
      .closest('li');

    expect(operationCard).not.toBeNull();

    await user.selectOptions(within(operationCard as HTMLElement).getByLabelText('Status'), 'DONE');

    expect(
      await screen.findByText('Board was out of date. Reloaded latest operations, please try again.'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(client.operation.list.query).toHaveBeenCalledTimes(2);
      const refreshedCard = within(screen.getByRole('region', { name: 'Backlog' }))
        .getByText('OP-100 — Ready backlog item')
        .closest('li');

      expect(refreshedCard).not.toBeNull();
      expect(within(refreshedCard as HTMLElement).getByLabelText('Status')).toHaveValue('DONE');
    });
  });

  it('reloads operations and shows the resync message when a blocked reason edit hits a version conflict', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query
      .mockResolvedValueOnce([
        {
          id: 'op-1',
          tenantId: 'tenant-a',
          orderId: 'ord-1',
          code: 'OP-100',
          title: 'Blocked backlog item',
          status: 'BLOCKED',
          sortIndex: 0,
          blockedReason: 'Waiting for material',
          version: 1,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'op-1',
          tenantId: 'tenant-a',
          orderId: 'ord-1',
          code: 'OP-100',
          title: 'Blocked backlog item',
          status: 'BLOCKED',
          sortIndex: 0,
          blockedReason: 'Supplier delayed shipment',
          version: 2,
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
      .getByText('OP-100 — Blocked backlog item')
      .closest('li');

    expect(operationCard).not.toBeNull();

    const blockedReasonInput = within(operationCard as HTMLElement).getByLabelText('Blocked reason');
    await user.clear(blockedReasonInput);
    await user.type(blockedReasonInput, 'Vendor confirmed Friday delivery');
    await user.click(within(operationCard as HTMLElement).getByRole('button', { name: 'Save reason' }));

    expect(
      await screen.findByText('Board was out of date. Reloaded latest operations, please try again.'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(client.operation.list.query).toHaveBeenCalledTimes(2);
      const refreshedCard = within(screen.getByRole('region', { name: 'Backlog' }))
        .getByText('OP-100 — Blocked backlog item')
        .closest('li');

      expect(refreshedCard).not.toBeNull();
      expect(within(refreshedCard as HTMLElement).getByDisplayValue('Supplier delayed shipment')).toBeInTheDocument();
      expect(within(refreshedCard as HTMLElement).getByText('Blocked: Supplier delayed shipment')).toBeInTheDocument();
    });
  });

  it('reloads operations and shows the resync message when a title edit hits a version conflict', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query
      .mockResolvedValueOnce([
        {
          id: 'op-1',
          tenantId: 'tenant-a',
          orderId: 'ord-1',
          code: 'OP-100',
          title: 'Original title',
          status: 'READY',
          sortIndex: 0,
          version: 1,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'op-1',
          tenantId: 'tenant-a',
          orderId: 'ord-1',
          code: 'OP-100',
          title: 'Server updated title',
          status: 'READY',
          sortIndex: 0,
          version: 2,
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
      .getByText('OP-100 — Original title')
      .closest('li');

    expect(operationCard).not.toBeNull();

    const titleInput = within(operationCard as HTMLElement).getByLabelText('Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Client edited title');
    await user.click(within(operationCard as HTMLElement).getByRole('button', { name: 'Save title' }));

    expect(
      await screen.findByText('Board was out of date. Reloaded latest operations, please try again.'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(client.operation.list.query).toHaveBeenCalledTimes(2);
      const refreshedCard = within(screen.getByRole('region', { name: 'Backlog' }))
        .getByText('OP-100 — Server updated title')
        .closest('li');

      expect(refreshedCard).not.toBeNull();
      expect(within(refreshedCard as HTMLElement).getByDisplayValue('Server updated title')).toBeInTheDocument();
    });
  });

  it('reloads operations and shows the resync message when a code edit hits a version conflict', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query
      .mockResolvedValueOnce([
        {
          id: 'op-1',
          tenantId: 'tenant-a',
          orderId: 'ord-1',
          code: 'OP-100',
          title: 'Original title',
          status: 'READY',
          sortIndex: 0,
          version: 1,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'op-1',
          tenantId: 'tenant-a',
          orderId: 'ord-1',
          code: 'OP-199',
          title: 'Original title',
          status: 'READY',
          sortIndex: 0,
          version: 2,
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
      .getByText('OP-100 — Original title')
      .closest('li');

    expect(operationCard).not.toBeNull();

    const codeInput = within(operationCard as HTMLElement).getByLabelText('Code');
    await user.clear(codeInput);
    await user.type(codeInput, 'OP-101');
    await user.click(within(operationCard as HTMLElement).getByRole('button', { name: 'Save code' }));

    expect(
      await screen.findByText('Board was out of date. Reloaded latest operations, please try again.'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(client.operation.list.query).toHaveBeenCalledTimes(2);
      const refreshedCard = within(screen.getByRole('region', { name: 'Backlog' }))
        .getByText('OP-199 — Original title')
        .closest('li');

      expect(refreshedCard).not.toBeNull();
      expect(within(refreshedCard as HTMLElement).getByDisplayValue('OP-199')).toBeInTheDocument();
    });
  });

  it('reloads operations and shows the resync message when an end date edit hits a version conflict', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query
      .mockResolvedValueOnce([
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
      ])
      .mockResolvedValueOnce([
        {
          id: 'op-1',
          tenantId: 'tenant-a',
          orderId: 'ord-1',
          code: 'OP-100',
          title: 'Ready backlog item',
          status: 'READY',
          sortIndex: 0,
          endDate: '2026-03-11T00:00:00.000Z',
          version: 2,
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
      .getByText('OP-100 — Ready backlog item')
      .closest('li');

    expect(operationCard).not.toBeNull();

    fireEvent.change(within(operationCard as HTMLElement).getByLabelText('End date'), {
      target: { value: '2026-03-10' },
    });
    await user.click(within(operationCard as HTMLElement).getByRole('button', { name: 'Save end' }));

    expect(
      await screen.findByText('Board was out of date. Reloaded latest operations, please try again.'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(client.operation.list.query).toHaveBeenCalledTimes(2);
      const refreshedCard = within(screen.getByRole('region', { name: 'Backlog' }))
        .getByText('OP-100 — Ready backlog item')
        .closest('li');

      expect(refreshedCard).not.toBeNull();
      expect(within(refreshedCard as HTMLElement).getByLabelText('End date')).toHaveValue('2026-03-11');
    });
  });

  it('reloads operations and shows the resync message when clearing an end date hits a version conflict', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query
      .mockResolvedValueOnce([
        {
          id: 'op-1',
          tenantId: 'tenant-a',
          orderId: 'ord-1',
          code: 'OP-100',
          title: 'Ready backlog item',
          status: 'READY',
          sortIndex: 0,
          endDate: '2026-03-10T00:00:00.000Z',
          version: 1,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'op-1',
          tenantId: 'tenant-a',
          orderId: 'ord-1',
          code: 'OP-100',
          title: 'Ready backlog item',
          status: 'READY',
          sortIndex: 0,
          endDate: '2026-03-12T00:00:00.000Z',
          version: 2,
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
      .getByText('OP-100 — Ready backlog item')
      .closest('li');

    expect(operationCard).not.toBeNull();

    await user.click(within(operationCard as HTMLElement).getByRole('button', { name: 'Clear end' }));

    expect(
      await screen.findByText('Board was out of date. Reloaded latest operations, please try again.'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(client.operation.list.query).toHaveBeenCalledTimes(2);
      const refreshedCard = within(screen.getByRole('region', { name: 'Backlog' }))
        .getByText('OP-100 — Ready backlog item')
        .closest('li');

      expect(refreshedCard).not.toBeNull();
      expect(within(refreshedCard as HTMLElement).getByLabelText('End date')).toHaveValue('2026-03-12');
      expect(within(refreshedCard as HTMLElement).getByRole('button', { name: 'Clear end' })).toBeInTheDocument();
    });
  });

  it('reloads operations and shows the resync message when clearing a blocked reason hits a version conflict', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query
      .mockResolvedValueOnce([
        {
          id: 'op-1',
          tenantId: 'tenant-a',
          orderId: 'ord-1',
          code: 'OP-100',
          title: 'Blocked backlog item',
          status: 'BLOCKED',
          sortIndex: 0,
          blockedReason: 'Waiting for material',
          version: 1,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'op-1',
          tenantId: 'tenant-a',
          orderId: 'ord-1',
          code: 'OP-100',
          title: 'Blocked backlog item',
          status: 'BLOCKED',
          sortIndex: 0,
          blockedReason: 'Supplier delayed shipment',
          version: 2,
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
      .getByText('OP-100 — Blocked backlog item')
      .closest('li');

    expect(operationCard).not.toBeNull();

    await user.click(within(operationCard as HTMLElement).getByRole('button', { name: 'Clear reason' }));

    expect(
      await screen.findByText('Board was out of date. Reloaded latest operations, please try again.'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(client.operation.list.query).toHaveBeenCalledTimes(2);
      const refreshedCard = within(screen.getByRole('region', { name: 'Backlog' }))
        .getByText('OP-100 — Blocked backlog item')
        .closest('li');

      expect(refreshedCard).not.toBeNull();
      expect(within(refreshedCard as HTMLElement).getByDisplayValue('Supplier delayed shipment')).toBeInTheDocument();
      expect(within(refreshedCard as HTMLElement).getByText('Blocked: Supplier delayed shipment')).toBeInTheDocument();
      expect(within(refreshedCard as HTMLElement).getByRole('button', { name: 'Clear reason' })).toBeInTheDocument();
    });
  });

  it('reloads operations and shows the resync message when a sort index edit hits a version conflict', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query
      .mockResolvedValueOnce([
        {
          id: 'op-1',
          tenantId: 'tenant-a',
          orderId: 'ord-1',
          code: 'OP-100',
          title: 'First backlog item',
          status: 'READY',
          sortIndex: 0,
          version: 1,
        },
        {
          id: 'op-2',
          tenantId: 'tenant-a',
          orderId: 'ord-1',
          code: 'OP-200',
          title: 'Second backlog item',
          status: 'READY',
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
          title: 'First backlog item',
          status: 'READY',
          sortIndex: -1,
          version: 2,
        },
        {
          id: 'op-2',
          tenantId: 'tenant-a',
          orderId: 'ord-1',
          code: 'OP-200',
          title: 'Second backlog item',
          status: 'READY',
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
      .getByText('OP-100 — First backlog item')
      .closest('li');

    expect(operationCard).not.toBeNull();

    const sortIndexInput = within(operationCard as HTMLElement).getByLabelText('Sort index');
    await user.clear(sortIndexInput);
    await user.type(sortIndexInput, '-1');
    await user.click(within(operationCard as HTMLElement).getByRole('button', { name: 'Save sort' }));

    expect(
      await screen.findByText('Board was out of date. Reloaded latest operations, please try again.'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(client.operation.list.query).toHaveBeenCalledTimes(2);

      const refreshedBacklogBucket = screen.getByRole('region', { name: 'Backlog' });
      const backlogItems = within(refreshedBacklogBucket).getAllByRole('listitem');

      expect(backlogItems[0]).toHaveTextContent('OP-100 — First backlog item');
      expect(within(backlogItems[0]).getByLabelText('Sort index')).toHaveValue(-1);
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

    const statusSelect = (await screen.findAllByLabelText('Status'))[0];
    const bucketSelect = screen.getByLabelText('Date bucket');
    const queryInput = screen.getByLabelText('Code or title');

    expect(statusSelect).toHaveValue('ALL');
    expect(bucketSelect).toHaveValue('ALL');
    expect(queryInput).toHaveValue('');
    expect(within(bucketSelect).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'All',
      'Backlog',
      '2026-03-06',
      '2026-03-07',
    ]);

    await user.selectOptions(statusSelect, 'DONE');
    await user.selectOptions(bucketSelect, '2026-03-06');
    await user.type(queryInput, 'op-200');

    expect(screen.queryByText('OP-100 — Ready backlog item')).not.toBeInTheDocument();
    expect(screen.getByText('OP-200 — Done dated item')).toBeInTheDocument();
    expect(screen.queryByText('OP-300 — Done later item')).not.toBeInTheDocument();
    expect(window.location.search).toBe('?status=DONE&bucket=2026-03-06&query=op-200');
  });

  it('hydrates the initial status, bucket, and text filters from URL search params', async () => {
    window.history.replaceState({}, '', '/?status=BLOCKED&bucket=Backlog&query=press');

    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query.mockResolvedValue([
      {
        id: 'op-1',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-100',
        title: 'Press blocked backlog item',
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

    expect((await screen.findAllByLabelText('Status'))[0]).toHaveValue('BLOCKED');
    expect(screen.getByLabelText('Date bucket')).toHaveValue('Backlog');
    expect(screen.getByLabelText('Code or title')).toHaveValue('press');
    expect(screen.getByText('OP-100 — Press blocked backlog item')).toBeInTheDocument();
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
      expect(screen.getAllByLabelText('Status')[0]).toHaveValue('DONE');
      expect(screen.getByLabelText('Date bucket')).toHaveValue('ALL');
      expect(window.location.search).toBe('?status=DONE');
    });

    expect(screen.getByText('OP-100 — Done backlog item')).toBeInTheDocument();
    expect(screen.getByText('OP-200 — Done loaded bucket item')).toBeInTheDocument();
    expect(screen.queryByText('OP-300 — Ready loaded bucket item')).not.toBeInTheDocument();
  });

  it('shows a filtered empty state and clears filters back to the default URL without reloading', async () => {
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
    ]);

    renderWithClient(client);
    await login();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load operations' }));

    await user.selectOptions((await screen.findAllByLabelText('Status'))[0], 'BLOCKED');

    expect(await screen.findByText('No operations match the current filters.')).toBeInTheDocument();
    expect(screen.getByText('Clear filters to return to the full board without reloading operations.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Backlog' })).not.toBeInTheDocument();
    expect(window.location.search).toBe('?status=BLOCKED');

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => {
      expect(screen.getAllByLabelText('Status')[0]).toHaveValue('ALL');
      expect(screen.getByLabelText('Date bucket')).toHaveValue('ALL');
      expect(screen.getByLabelText('Code or title')).toHaveValue('');
      expect(window.location.search).toBe('');
      expect(screen.getByRole('region', { name: 'Backlog' })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: '2026-03-06' })).toBeInTheDocument();
    });

    expect(client.operation.list.query).toHaveBeenCalledTimes(1);
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
