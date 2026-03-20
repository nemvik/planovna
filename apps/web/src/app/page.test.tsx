import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Home from './page';
import { createTrpcClient } from '../lib/trpc/client';

jest.mock('../lib/trpc/client', () => ({
  createTrpcClient: jest.fn(),
}));

const HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY = 'planovna.homepage.accessToken';

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
      query: jest.fn().mockResolvedValue([]),
    },
    update: {
      mutate: jest.fn(),
    },
  },
  cashflow: {
    list: {
      query: jest.fn().mockResolvedValue([]),
    },
  },
  invoice: {
    list: {
      query: jest.fn().mockResolvedValue([]),
    },
  },
});

const createFetchResponse = (
  body: unknown,
  init: { ok?: boolean; status?: number } = {},
) =>
  ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: jest.fn().mockResolvedValue(body),
  }) as unknown as Response;

const setFetchMock = (response: Response) => {
  const fetchScope = globalThis as Record<string, unknown>;
  const previousFetch = fetchScope.fetch;
  const fetchMock = jest.fn().mockResolvedValue(response);

  fetchScope.fetch = fetchMock;

  return {
    fetchMock,
    restore: () => {
      if (previousFetch === undefined) {
        delete fetchScope.fetch;
      } else {
        fetchScope.fetch = previousFetch;
      }
    },
  };
};

const renderWithClient = (client: ReturnType<typeof createClient>) => {
  const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;
  createTrpcClientMock.mockImplementation(() => client as never);
  return render(<Home />);
};

const login = async (email = 'owner@tenant-a.local', password = 'tenant-a-pass') => {
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText('Email'));
  await user.type(screen.getByLabelText('Email'), email);
  await user.clear(screen.getByLabelText('Password'));
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Login' }));
};

const register = async (
  email = 'new@tenant-a.local',
  password = 'tenant-a-pass',
  companyName = 'Acme',
) => {
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText('Registration email'));
  await user.type(screen.getByLabelText('Registration email'), email);
  await user.clear(screen.getByLabelText('Registration password'));
  await user.type(screen.getByLabelText('Registration password'), password);
  await user.clear(screen.getByLabelText('Company name'));
  await user.type(screen.getByLabelText('Company name'), companyName);
  await user.click(screen.getByRole('button', { name: 'Register' }));
};

const loginAndWaitForAutoLoad = async (
  client: ReturnType<typeof createClient>,
  email = 'owner@tenant-a.local',
  password = 'tenant-a-pass',
) => {
  await login(email, password);
  await waitFor(() => {
    expect(client.operation.list.query).toHaveBeenCalledTimes(1);
  });
};

const getOperationCard = (bucketLabel: string, operationText: string) => {
  const bucket = screen.getByRole('region', { name: bucketLabel });
  const card = within(bucket).getByText(operationText).closest('li');

  expect(card).not.toBeNull();

  return card as HTMLElement;
};

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
  document.documentElement.lang = '';
});

describe('homepage operations board', () => {
  it('renders default English homepage header and auth labels from locale copy', () => {
    const client = createClient();

    renderWithClient(client);

    expect(screen.getByRole('heading', { name: 'Planovna operations board' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Lightweight planning board for moving operations between backlog and loaded start-date buckets.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByLabelText('Registration email')).toBeInTheDocument();
    expect(screen.getByLabelText('Registration password')).toBeInTheDocument();
    expect(screen.getByLabelText('Company name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load operations' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Logout and reset session' })).not.toBeInTheDocument();
  });

  it('resolves homepage locale copy from html lang when supported', () => {
    const client = createClient();
    document.documentElement.lang = 'de';

    renderWithClient(client);

    expect(screen.getByRole('heading', { name: 'Planovna-Operationsboard' })).toBeInTheDocument();
    expect(screen.getByLabelText('E-Mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Passwort')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anmelden' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vorgänge laden' })).toBeInTheDocument();
  });

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

  it('registers a new tenant owner and reuses the same post-login load flow', async () => {
    const client = createClient();
    const fetchStub = setFetchMock(
      createFetchResponse({ accessToken: 'token-tenant-new', tokenType: 'Bearer', expiresAt: '2099-01-01T00:00:00.000Z' }),
    );

    try {
      renderWithClient(client);

      await register('owner-new@tenant-a.local', 'new-password', 'Acme Co.');

      expect(await screen.findByText('Logged in')).toBeInTheDocument();

      expect(window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY)).toBe('token-tenant-new');
      expect(fetchStub.fetchMock).toHaveBeenCalledTimes(1);
      expect(client.auth.login.mutate).not.toHaveBeenCalled();
      expect(client.cashflow.list.query).toHaveBeenCalledTimes(1);
      expect(client.invoice.list.query).toHaveBeenCalledTimes(1);
      expect(client.operation.list.query).toHaveBeenCalledTimes(1);
    } finally {
      fetchStub.restore();
    }
  });

  it('marks registration inputs as required to block empty browser submits', () => {
    const client = createClient();

    renderWithClient(client);

    expect(screen.getByLabelText('Registration email')).toBeRequired();
    expect(screen.getByLabelText('Registration password')).toBeRequired();
    expect(screen.getByLabelText('Company name')).toBeRequired();
  });

  it('shows a safe error when registering an already used email', async () => {
    const client = createClient();
    const fetchStub = setFetchMock(
      createFetchResponse({ message: 'Email already exists' }, { ok: false, status: 409 }),
    );

    try {
      renderWithClient(client);

      await register('owner@tenant-a.local', 'tenant-a-pass', 'Acme Co.');

      expect(
        await screen.findByText('This email is already registered. Please log in instead.'),
      ).toBeInTheDocument();
      expect(window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
      expect(client.auth.login.mutate).not.toHaveBeenCalled();
      expect(client.operation.list.query).not.toHaveBeenCalled();
    } finally {
      fetchStub.restore();
    }
  });

  it('shows explicit retry guidance when registration is rate-limited', async () => {
    const client = createClient();
    const fetchStub = setFetchMock(
      createFetchResponse({ message: 'Too many attempts' }, { ok: false, status: 429 }),
    );

    try {
      renderWithClient(client);

      await register('owner@tenant-a.local', 'tenant-a-pass', 'Acme Co.');

      expect(
        await screen.findByText('Too many registration attempts. Please wait a moment and try again.'),
      ).toBeInTheDocument();
      expect(window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
      expect(client.auth.login.mutate).not.toHaveBeenCalled();
      expect(client.operation.list.query).not.toHaveBeenCalled();
    } finally {
      fetchStub.restore();
    }
  });

  it('shows a minimal cashflow snapshot after login using the shipped cashflow contract', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.cashflow.list.query.mockResolvedValue([
      {
        id: 'cf-planned',
        tenantId: 'tenant-a',
        invoiceId: 'inv-1',
        kind: 'PLANNED_IN',
        amount: 121000,
        currency: 'CZK',
        date: '2026-03-15T00:00:00.000Z',
      },
      {
        id: 'cf-actual',
        tenantId: 'tenant-a',
        invoiceId: 'inv-1',
        kind: 'ACTUAL_IN',
        amount: 60000,
        currency: 'CZK',
        date: '2026-03-10T00:00:00.000Z',
      },
    ]);
    client.invoice.list.query.mockResolvedValue([
      {
        id: 'inv-1',
        number: '2026-0001',
        status: 'ISSUED',
        amountGross: 121000,
        currency: 'CZK',
        dueAt: '2026-03-15T00:00:00.000Z',
        pdfPath: '/invoices/inv-1/pdf',
      },
      {
        id: 'inv-2',
        number: '2026-0002',
        status: 'PAID',
        amountGross: 50000,
        currency: 'CZK',
        dueAt: '2026-03-10T00:00:00.000Z',
        pdfPath: '/invoices/inv-2/pdf',
      },
    ]);

    renderWithClient(client);
    await loginAndWaitForAutoLoad(client);

    const cashflowSummary = await screen.findByRole('region', { name: 'Cashflow summary' });
    expect(cashflowSummary).toBeInTheDocument();
    expect(cashflowSummary).toHaveTextContent('Planned in');
    expect(cashflowSummary).toHaveTextContent('121');
    expect(cashflowSummary).toHaveTextContent('Actual in');
    expect(cashflowSummary).toHaveTextContent('60');
    expect(cashflowSummary).toHaveTextContent('Invoice workspace');
    expect(cashflowSummary).toHaveTextContent('Invoice status');
    expect(cashflowSummary).toHaveTextContent('1 issued / 1 paid');
    expect(cashflowSummary).toHaveTextContent('2 invoices loaded');
    expect(cashflowSummary).toHaveTextContent(
      'Review invoice status here, then jump directly to the dedicated invoice or cashflow pages for the next finance step.',
    );
    expect(cashflowSummary).toHaveTextContent('2026-03-10');
    expect(cashflowSummary).toHaveTextContent('Next cashflow items');
    expect(screen.getByRole('link', { name: 'Open cashflow page' })).toHaveAttribute('href', '/cashflow');
    expect(screen.getByRole('link', { name: 'Open invoices page' })).toHaveAttribute('href', '/invoices');
    expect(screen.getByRole('link', { name: 'Open invoices workspace' })).toHaveAttribute('href', '/invoices');
    expect(client.cashflow.list.query).toHaveBeenCalledTimes(1);
  });

  it('formats homepage cashflow money using resolved locale', async () => {
    const client = createClient();
    document.documentElement.lang = 'de';
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.cashflow.list.query.mockResolvedValue([
      {
        id: 'cf-planned',
        tenantId: 'tenant-a',
        invoiceId: 'inv-1',
        kind: 'PLANNED_IN',
        amount: 1234.56,
        currency: 'EUR',
        date: '2026-03-15T00:00:00.000Z',
      },
    ]);
    client.invoice.list.query.mockResolvedValue([]);

    const user = userEvent.setup();

    renderWithClient(client);
    await user.click(screen.getByRole('button', { name: 'Anmelden' }));
    await waitFor(() => {
      expect(client.operation.list.query).toHaveBeenCalledTimes(1);
    });

    const cashflowSummary = await screen.findByRole('region', { name: 'Cashflow-Übersicht' });
    expect(cashflowSummary).toHaveTextContent('1.234,56');
  });

  it('localizes homepage status filter option labels while keeping enum values', async () => {
    const client = createClient();
    document.documentElement.lang = 'de';
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query.mockResolvedValue([
      {
        id: 'op-1',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-100',
        title: 'Bereit Vorgang',
        status: 'READY',
        sortIndex: 0,
        version: 1,
      },
    ]);

    const user = userEvent.setup();
    renderWithClient(client);

    await user.click(screen.getByRole('button', { name: 'Anmelden' }));

    const statusSelect = (await screen.findAllByLabelText('Status'))[0];
    const optionLabels = within(statusSelect)
      .getAllByRole('option')
      .map((option) => option.textContent);

    expect(optionLabels).toEqual(['Alle', 'Bereit', 'In Bearbeitung', 'Erledigt', 'Blockiert']);
    expect(statusSelect).toHaveValue('ALL');
  });

  it('auto-loads operations once after a successful login', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });

    renderWithClient(client);
    await loginAndWaitForAutoLoad(client);

    expect(await screen.findByText('No operations found.')).toBeInTheDocument();
    expect(client.operation.list.query).toHaveBeenCalledTimes(1);
  });

  it('persists the homepage access token after a successful login', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });

    renderWithClient(client);
    await loginAndWaitForAutoLoad(client);

    expect(window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY)).toBe('token-owner');
  });

  it('does not auto-load operations after a failed login', async () => {
    const client = createClient();
    client.auth.login.mutate.mockRejectedValue(new Error('invalid'));

    renderWithClient(client);
    await login('owner@tenant-a.local', 'bad-pass');

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(client.operation.list.query).not.toHaveBeenCalled();
  });

  it('does not duplicate the initial auto-load after a successful login', async () => {
    const client = createClient();
    const deferred = createDeferred<unknown[]>();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query.mockReturnValue(deferred.promise);

    renderWithClient(client);
    await loginAndWaitForAutoLoad(client);

    deferred.resolve([]);
    expect(await screen.findByText('No operations found.')).toBeInTheDocument();
    await waitFor(() => {
      expect(client.operation.list.query).toHaveBeenCalledTimes(1);
    });
  });

  it('guards homepage login while a pending submit is still in flight and allows retry after failure', async () => {
    const client = createClient();
    const deferredLogin = createDeferred<{ accessToken: string }>();
    client.auth.login.mutate
      .mockReturnValueOnce(deferredLogin.promise)
      .mockResolvedValueOnce({ accessToken: 'token-owner' });

    renderWithClient(client);

    const loginButton = screen.getByRole('button', { name: 'Login' });
    const loadOperationsButton = screen.getByRole('button', { name: 'Load operations' });

    fireEvent.click(loginButton);
    fireEvent.click(loginButton);

    expect(client.auth.login.mutate).toHaveBeenCalledTimes(1);
    expect(client.operation.list.query).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Logging in...' })).toBeDisabled();
    expect(screen.getByLabelText('Email')).toBeDisabled();
    expect(screen.getByLabelText('Password')).toBeDisabled();
    expect(loadOperationsButton).toBeDisabled();

    deferredLogin.reject(new Error('invalid'));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login' })).toBeEnabled();
    expect(screen.getByLabelText('Email')).toBeEnabled();
    expect(screen.getByLabelText('Password')).toBeEnabled();
    expect(client.operation.list.query).not.toHaveBeenCalled();

    await login();

    await waitFor(() => {
      expect(client.auth.login.mutate).toHaveBeenCalledTimes(2);
      expect(client.operation.list.query).toHaveBeenCalledTimes(1);
    });
  });

  it('hydrates stored auth and auto-loads operations exactly once after reload', async () => {
    const client = createClient();
    const deferred = createDeferred<unknown[]>();
    client.operation.list.query.mockReturnValue(deferred.promise);
    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');

    renderWithClient(client);

    await waitFor(() => {
      expect(client.auth.login.mutate).not.toHaveBeenCalled();
      expect(client.operation.list.query).toHaveBeenCalledTimes(1);
    });

    deferred.resolve([]);

    expect(await screen.findByText('Logged in')).toBeInTheDocument();
    expect(await screen.findByText('No operations found.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load operations' })).toBeEnabled();

    await waitFor(() => {
      expect(client.operation.list.query).toHaveBeenCalledTimes(1);
    });
  });

  it('expires a hydrated session when the first auto-load returns forbidden', async () => {
    const client = createClient();
    client.operation.list.query.mockRejectedValue({ data: { code: 'FORBIDDEN' } });
    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');

    renderWithClient(client);

    expect(await screen.findByText('Session expired. Please log in again.')).toBeInTheDocument();

    await waitFor(() => {
      expect(client.auth.login.mutate).not.toHaveBeenCalled();
      expect(client.operation.list.query).toHaveBeenCalledTimes(1);
      expect(window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
      expect(screen.getByRole('button', { name: 'Load operations' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Logout and reset session' })).not.toBeInTheDocument();
      expect(screen.queryByText('Forbidden: your role is not allowed to view operations.')).not.toBeInTheDocument();
    });
  });

  it('expires the session when the post-login auto-load returns forbidden', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query.mockRejectedValue({ data: { code: 'FORBIDDEN' } });

    renderWithClient(client);

    await login('owner@tenant-a.local', 'tenant-a-pass');

    expect(await screen.findByText('Session expired. Please log in again.')).toBeInTheDocument();

    await waitFor(() => {
      expect(client.auth.login.mutate).toHaveBeenCalledTimes(1);
      expect(client.operation.list.query).toHaveBeenCalledTimes(1);
      expect(window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
      expect(screen.getByRole('button', { name: 'Load operations' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Logout and reset session' })).not.toBeInTheDocument();
      expect(screen.queryByText('Forbidden: your role is not allowed to view operations.')).not.toBeInTheDocument();
    });
  });

  it('clears the persisted homepage token and resets loaded board state on logout', async () => {
    const client = createClient();
    client.operation.list.query.mockResolvedValue([
      {
        id: 'op-1',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-100',
        title: 'Loaded backlog item',
        status: 'READY',
        sortIndex: 0,
        dependencyCount: 0,
        version: 1,
      },
    ]);
    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');

    renderWithClient(client);

    expect(await screen.findByText('OP-100 — Loaded backlog item')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Logout and reset session' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load operations' })).toBeEnabled();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Logout and reset session' }));

    await waitFor(() => {
      expect(window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
      expect(screen.getByText('Logged out')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Load operations' })).toBeDisabled();
      expect(screen.queryByText('OP-100 — Loaded backlog item')).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Backlog' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Logout and reset session' })).not.toBeInTheDocument();
    });
  });

  it('ignores an in-flight manual load response after logout resets the session', async () => {
    const client = createClient();
    const deferredReload = createDeferred<unknown[]>();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query
      .mockResolvedValueOnce([
        {
          id: 'op-1',
          tenantId: 'tenant-a',
          orderId: 'ord-1',
          code: 'OP-100',
          title: 'Existing board item',
          status: 'READY',
          sortIndex: 0,
          dependencyCount: 0,
          version: 1,
        },
      ])
      .mockReturnValueOnce(deferredReload.promise);

    renderWithClient(client);
    await loginAndWaitForAutoLoad(client);

    expect(await screen.findByText('OP-100 — Existing board item')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load operations' }));

    expect(screen.getByRole('button', { name: 'Loading operations…' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Logout and reset session' }));

    deferredReload.resolve([
      {
        id: 'op-2',
        tenantId: 'tenant-a',
        orderId: 'ord-2',
        code: 'OP-200',
        title: 'Stale reloaded item',
        status: 'READY',
        sortIndex: 0,
        dependencyCount: 0,
        version: 1,
      },
    ]);

    await waitFor(() => {
      expect(window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
      expect(screen.getByText('Logged out')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Load operations' })).toBeDisabled();
      expect(screen.queryByText('OP-100 — Existing board item')).not.toBeInTheDocument();
      expect(screen.queryByText('OP-200 — Stale reloaded item')).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Backlog' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Logout and reset session' })).not.toBeInTheDocument();
    });
  });

  it('ignores a hydrated auto-load response after logout resets the session mid-load', async () => {
    const client = createClient();
    const deferredLoad = createDeferred<unknown[]>();
    client.operation.list.query.mockReturnValue(deferredLoad.promise);
    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');

    renderWithClient(client);

    await waitFor(() => {
      expect(client.operation.list.query).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Logout and reset session' })).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Logout and reset session' }));

    deferredLoad.resolve([
      {
        id: 'op-1',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-100',
        title: 'Hydrated stale item',
        status: 'READY',
        sortIndex: 0,
        dependencyCount: 0,
        version: 1,
      },
    ]);

    await waitFor(() => {
      expect(window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
      expect(screen.getByText('Logged out')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Load operations' })).toBeDisabled();
      expect(screen.queryByText('Hydrated stale item')).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Backlog' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Logout and reset session' })).not.toBeInTheDocument();
    });
  });

  it('ignores a post-login auto-load response after logout resets the session mid-load', async () => {
    const client = createClient();
    const deferredLoad = createDeferred<unknown[]>();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query.mockReturnValue(deferredLoad.promise);

    renderWithClient(client);
    await login('owner@tenant-a.local', 'tenant-a-pass');

    await waitFor(() => {
      expect(client.operation.list.query).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Logout and reset session' })).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Logout and reset session' }));

    deferredLoad.resolve([
      {
        id: 'op-1',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-100',
        title: 'Post-login stale item',
        status: 'READY',
        sortIndex: 0,
        dependencyCount: 0,
        version: 1,
      },
    ]);

    await waitFor(() => {
      expect(window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
      expect(screen.getByText('Logged out')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Load operations' })).toBeDisabled();
      expect(screen.queryByText('Post-login stale item')).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Backlog' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Logout and reset session' })).not.toBeInTheDocument();
    });
  });

  it('keeps load operations disabled after logout until a fresh login succeeds', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-fresh' });
    client.operation.list.query
      .mockResolvedValueOnce([
        {
          id: 'op-1',
          tenantId: 'tenant-a',
          orderId: 'ord-1',
          code: 'OP-100',
          title: 'Loaded backlog item',
          status: 'READY',
          sortIndex: 0,
          dependencyCount: 0,
          version: 1,
        },
      ])
      .mockResolvedValueOnce([]);
    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');

    renderWithClient(client);

    expect(await screen.findByText('OP-100 — Loaded backlog item')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Logout and reset session' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Load operations' })).toBeDisabled();
    });

    await login('owner@tenant-a.local', 'tenant-a-pass');

    await waitFor(() => {
      expect(client.auth.login.mutate).toHaveBeenCalledTimes(1);
      expect(client.operation.list.query).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText('No operations found.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load operations' })).toBeEnabled();
    expect(window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY)).toBe('token-fresh');
  });

  it('shows operation loading state', async () => {
    const client = createClient();
    const deferred = createDeferred<unknown[]>();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query.mockReturnValue(deferred.promise);

    renderWithClient(client);
    await loginAndWaitForAutoLoad(client);

    expect(screen.getAllByText('Loading operations…').length).toBeGreaterThan(0);

    deferred.resolve([]);
    await waitFor(() => {
      expect(screen.getByText('No operations found.')).toBeInTheDocument();
    });
  });

  it('shows an explicit error state when the first post-login load fails without prior board data', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query.mockRejectedValueOnce(new Error('initial load failed'));

    renderWithClient(client);
    await login('owner@tenant-a.local', 'tenant-a-pass');

    expect(await screen.findByText('Failed to load operations.')).toBeInTheDocument();
    expect(screen.getByText('Logged in')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load operations' })).toBeEnabled();
    expect(screen.queryByRole('region', { name: 'Backlog' })).not.toBeInTheDocument();
  });

  it('sends only one manual operations reload while a prior manual reload is still pending', async () => {
    const client = createClient();
    const deferredReload = createDeferred<unknown[]>();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query
      .mockResolvedValueOnce([
        {
          id: 'op-1',
          tenantId: 'tenant-a',
          orderId: 'ord-1',
          code: 'OP-100',
          title: 'Existing board item',
          status: 'READY',
          sortIndex: 0,
          dependencyCount: 0,
          version: 1,
        },
      ])
      .mockReturnValueOnce(deferredReload.promise);

    renderWithClient(client);
    await loginAndWaitForAutoLoad(client);

    expect(await screen.findByText('OP-100 — Existing board item')).toBeInTheDocument();

    const loadOperationsButton = screen.getByRole('button', { name: 'Load operations' });

    fireEvent.click(loadOperationsButton);
    fireEvent.click(loadOperationsButton);

    expect(client.operation.list.query).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Loading operations…' })).toBeDisabled();
    expect(screen.getByText('Logged in')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Logout and reset session' })).toBeInTheDocument();

    deferredReload.resolve([
      {
        id: 'op-1',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-100',
        title: 'Reloaded board item',
        status: 'READY',
        sortIndex: 0,
        dependencyCount: 0,
        version: 2,
      },
    ]);

    expect(await screen.findByText('OP-100 — Reloaded board item')).toBeInTheDocument();
    await waitFor(() => {
      expect(client.operation.list.query).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('button', { name: 'Load operations' })).toBeEnabled();
    });
  });

  it('preserves the last loaded board when a manual reload fails and allows retrying', async () => {
    const client = createClient();
    const deferredReload = createDeferred<unknown[]>();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query
      .mockResolvedValueOnce([
        {
          id: 'op-1',
          tenantId: 'tenant-a',
          orderId: 'ord-1',
          code: 'OP-100',
          title: 'Existing board item',
          status: 'READY',
          sortIndex: 0,
          dependencyCount: 0,
          version: 1,
        },
      ])
      .mockReturnValueOnce(deferredReload.promise)
      .mockResolvedValueOnce([
        {
          id: 'op-2',
          tenantId: 'tenant-a',
          orderId: 'ord-2',
          code: 'OP-200',
          title: 'Retry board item',
          status: 'READY',
          sortIndex: 0,
          dependencyCount: 0,
          version: 1,
        },
      ]);

    renderWithClient(client);
    await loginAndWaitForAutoLoad(client);

    expect(await screen.findByText('OP-100 — Existing board item')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Load operations' }));

    expect(screen.getByRole('button', { name: 'Loading operations…' })).toBeDisabled();

    deferredReload.reject(new Error('manual reload failed'));

    expect(
      await screen.findByText('Failed to reload operations. Showing the last loaded board.'),
    ).toBeInTheDocument();
    expect(screen.getByText('OP-100 — Existing board item')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load operations' })).toBeEnabled();
    expect(screen.getByText('Logged in')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Logout and reset session' })).toBeInTheDocument();
    expect(window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY)).toBe('token-owner');

    fireEvent.click(screen.getByRole('button', { name: 'Load operations' }));

    expect(await screen.findByText('OP-200 — Retry board item')).toBeInTheDocument();
    await waitFor(() => {
      expect(client.operation.list.query).toHaveBeenCalledTimes(3);
      expect(screen.getByRole('button', { name: 'Load operations' })).toBeEnabled();
      expect(
        screen.queryByText('Failed to reload operations. Showing the last loaded board.'),
      ).not.toBeInTheDocument();
    });
  });

  it('expires the session when a manual load returns forbidden after board data was loaded', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query
      .mockResolvedValueOnce([
        {
          id: 'op-1',
          tenantId: 'tenant-a',
          orderId: 'ord-1',
          code: 'OP-100',
          title: 'Existing board item',
          status: 'READY',
          sortIndex: 0,
          dependencyCount: 0,
          version: 1,
        },
      ])
      .mockRejectedValueOnce({ data: { code: 'FORBIDDEN' } });

    renderWithClient(client);
    await loginAndWaitForAutoLoad(client);

    expect(await screen.findByText('OP-100 — Existing board item')).toBeInTheDocument();
    expect(window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY)).toBe('token-owner');

    fireEvent.click(screen.getByRole('button', { name: 'Load operations' }));

    expect(await screen.findByText('Session expired. Please log in again.')).toBeInTheDocument();

    await waitFor(() => {
      expect(client.operation.list.query).toHaveBeenCalledTimes(2);
      expect(window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
      expect(screen.getByRole('button', { name: 'Load operations' })).toBeDisabled();
      expect(screen.queryByText('OP-100 — Existing board item')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Logout and reset session' })).not.toBeInTheDocument();
      expect(screen.queryByText('Forbidden: your role is not allowed to view operations.')).not.toBeInTheDocument();
    });
  });

  it('rehydrates schedule inputs from freshly reloaded board data after a manual reload', async () => {
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
          orderId: 'ord-2',
          code: 'OP-200',
          title: 'Loaded dated item',
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
          startDate: '2026-03-08T00:00:00.000Z',
          sortIndex: 0,
          version: 2,
        },
        {
          id: 'op-2',
          tenantId: 'tenant-a',
          orderId: 'ord-2',
          code: 'OP-200',
          title: 'Loaded dated item',
          status: 'READY',
          sortIndex: 1,
          version: 2,
        },
      ]);

    renderWithClient(client);
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();

    const backlogBucket = await screen.findByRole('region', { name: 'Backlog' });
    const backlogCard = within(backlogBucket).getByText('OP-100 — Backlog item').closest('li');
    const datedBucket = screen.getByRole('region', { name: '2026-03-06' });
    const datedCard = within(datedBucket).getByText('OP-200 — Loaded dated item').closest('li');

    expect(backlogCard).not.toBeNull();
    expect(datedCard).not.toBeNull();

    fireEvent.change(within(backlogCard as HTMLElement).getByLabelText('Schedule to date'), {
      target: { value: '2026-03-09' },
    });
    fireEvent.change(within(datedCard as HTMLElement).getByLabelText('Schedule to date'), {
      target: { value: '2026-03-10' },
    });

    await user.click(screen.getByRole('button', { name: 'Load operations' }));

    await waitFor(() => {
      expect(client.operation.list.query).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('region', { name: '2026-03-08' })).toBeInTheDocument();
    });

    const reloadedDatedBucket = screen.getByRole('region', { name: '2026-03-08' });
    const reloadedBacklogBucket = screen.getByRole('region', { name: 'Backlog' });
    const reloadedDatedCard = within(reloadedDatedBucket).getByText('OP-100 — Backlog item').closest('li');
    const reloadedBacklogCard = within(reloadedBacklogBucket)
      .getByText('OP-200 — Loaded dated item')
      .closest('li');

    expect(reloadedDatedCard).not.toBeNull();
    expect(reloadedBacklogCard).not.toBeNull();
    expect(within(reloadedDatedCard as HTMLElement).getByLabelText('Schedule to date')).toHaveValue('2026-03-08');
    expect(within(reloadedBacklogCard as HTMLElement).getByLabelText('Schedule to date')).toHaveValue('');
  });

  it('shows operation empty state', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query.mockResolvedValue([]);

    renderWithClient(client);
    await loginAndWaitForAutoLoad(client);

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
    await loginAndWaitForAutoLoad(client);

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
    await loginAndWaitForAutoLoad(client);

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
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();

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
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();

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
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();

    await user.selectOptions(screen.getAllByLabelText('Status')[0], 'READY');

    expect(await screen.findByText('Showing 2 of 3 operations.')).toBeInTheDocument();
    expect(screen.getByText('Status: Ready')).toBeInTheDocument();

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
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();
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
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();
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
    expect(screen.queryByText('Status: Ready')).not.toBeInTheDocument();
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
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();
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
    expect(screen.getByText('Status: Ready')).toBeInTheDocument();
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
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();
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
    expect(screen.getByText('Status: Ready')).toBeInTheDocument();
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
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();

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
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();

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

  it('expires the session when an inline title edit returns forbidden', async () => {
    const client = createClient();
    const deferredUpdate = createDeferred<never>();
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
        dependencyCount: 0,
      },
    ]);
    client.operation.update.mutate.mockReturnValue(deferredUpdate.promise);

    renderWithClient(client);
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();

    const backlogBucket = await screen.findByRole('region', { name: 'Backlog' });
    const operationCard = within(backlogBucket)
      .getByText('OP-100 — Original title')
      .closest('li');

    expect(operationCard).not.toBeNull();

    const titleInput = within(operationCard as HTMLElement).getByLabelText('Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Expired title');
    await user.click(within(operationCard as HTMLElement).getByRole('button', { name: 'Save title' }));

    expect(within(operationCard as HTMLElement).getByText('Saving…')).toBeInTheDocument();

    deferredUpdate.reject({ data: { code: 'FORBIDDEN' } });

    expect(await screen.findByText('Session expired. Please log in again.')).toBeInTheDocument();

    await waitFor(() => {
      expect(client.operation.update.mutate).toHaveBeenCalledWith({
        id: 'op-1',
        tenantId: 'tenant-a',
        version: 1,
        title: 'Expired title',
      });
      expect(window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
      expect(screen.getByRole('button', { name: 'Load operations' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Logout and reset session' })).not.toBeInTheDocument();
      expect(screen.queryByText('OP-100 — Original title')).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue('Expired title')).not.toBeInTheDocument();
      expect(screen.queryByText('Failed to update title.')).not.toBeInTheDocument();
      expect(screen.queryByText('Board was out of date. Reloaded latest operations, please try again.')).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Backlog' })).not.toBeInTheDocument();
    });
  });

  it('guards duplicate inline operation updates while a homepage mutation is still pending and allows retry after failure', async () => {
    const client = createClient();
    const deferredUpdate = createDeferred<{
      id: string;
      tenantId: string;
      orderId: string;
      code: string;
      title: string;
      status: 'READY';
      sortIndex: number;
      version: number;
    }>();
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
        dependencyCount: 0,
      },
      {
        id: 'op-2',
        tenantId: 'tenant-a',
        orderId: 'ord-2',
        code: 'OP-200',
        title: 'Second title',
        status: 'READY',
        sortIndex: 1,
        version: 1,
        dependencyCount: 0,
      },
    ]);
    client.operation.update.mutate
      .mockReturnValueOnce(deferredUpdate.promise)
      .mockResolvedValueOnce({
        id: 'op-1',
        tenantId: 'tenant-a',
        orderId: 'ord-1',
        code: 'OP-100',
        title: 'Retried title',
        status: 'READY',
        sortIndex: 0,
        version: 2,
      });

    renderWithClient(client);
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();

    const backlogBucket = await screen.findByRole('region', { name: 'Backlog' });
    const operationCard = within(backlogBucket)
      .getByText('OP-100 — Original title')
      .closest('li');
    const secondOperationCard = within(backlogBucket)
      .getByText('OP-200 — Second title')
      .closest('li');

    expect(operationCard).not.toBeNull();
    expect(secondOperationCard).not.toBeNull();

    const titleInput = within(operationCard as HTMLElement).getByLabelText('Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Pending title');

    const saveTitleButton = within(operationCard as HTMLElement).getByRole('button', { name: 'Save title' });
    fireEvent.click(saveTitleButton);
    fireEvent.click(saveTitleButton);

    expect(client.operation.update.mutate).toHaveBeenCalledTimes(1);
    expect(client.operation.update.mutate).toHaveBeenCalledWith({
      id: 'op-1',
      tenantId: 'tenant-a',
      version: 1,
      title: 'Pending title',
    });
    expect(client.operation.list.query).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Logged in')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load operations' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Logout and reset session' })).toBeInTheDocument();
    expect(within(operationCard as HTMLElement).getByText('OP-100 — Original title')).toBeInTheDocument();
    expect(within(operationCard as HTMLElement).getByText('Saving…')).toBeInTheDocument();
    expect(within(secondOperationCard as HTMLElement).queryByText('Saving…')).not.toBeInTheDocument();
    expect(within(operationCard as HTMLElement).getByRole('button', { name: 'Save title' })).toBeDisabled();
    expect(within(secondOperationCard as HTMLElement).getByRole('button', { name: 'Save title' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Load operations' }));

    expect(client.operation.list.query).toHaveBeenCalledTimes(1);

    deferredUpdate.reject(new Error('slow failure'));

    expect(await screen.findByText('Failed to update title.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load operations' })).toBeEnabled();
    expect(within(operationCard as HTMLElement).getByRole('button', { name: 'Save title' })).toBeEnabled();
    expect(within(operationCard as HTMLElement).getByDisplayValue('Pending title')).toBeInTheDocument();
    expect(within(operationCard as HTMLElement).getByText('OP-100 — Original title')).toBeInTheDocument();
    expect(within(operationCard as HTMLElement).queryByText('Saving…')).not.toBeInTheDocument();

    await user.clear(titleInput);
    await user.type(titleInput, 'Retried title');
    await user.click(within(operationCard as HTMLElement).getByRole('button', { name: 'Save title' }));

    expect(client.operation.update.mutate).toHaveBeenCalledTimes(2);
    expect(client.operation.update.mutate).toHaveBeenLastCalledWith({
      id: 'op-1',
      tenantId: 'tenant-a',
      version: 1,
      title: 'Retried title',
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Load operations' })).toBeEnabled();
      expect(within(operationCard as HTMLElement).getByDisplayValue('Retried title')).toBeInTheDocument();
      expect(within(operationCard as HTMLElement).getByText('OP-100 — Retried title')).toBeInTheDocument();
      expect(within(operationCard as HTMLElement).queryByText('Saving…')).not.toBeInTheDocument();
    });
  });

  it('locks non-active inline mutation controls during a pending save and re-enables them after success', async () => {
    const client = createClient();
    const deferredUpdate = createDeferred<{
      id: string;
      tenantId: string;
      orderId: string;
      code: string;
      title: string;
      status: 'READY';
      sortIndex: number;
      version: number;
      dependencyCount: number;
    }>();
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
        dependencyCount: 0,
      },
      {
        id: 'op-2',
        tenantId: 'tenant-a',
        orderId: 'ord-2',
        code: 'OP-200',
        title: 'Second title',
        status: 'READY',
        sortIndex: 1,
        version: 1,
        dependencyCount: 0,
      },
    ]);
    client.operation.update.mutate.mockReturnValueOnce(deferredUpdate.promise);

    renderWithClient(client);
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();
    const firstCard = getOperationCard('Backlog', 'OP-100 — Original title');
    const secondCard = getOperationCard('Backlog', 'OP-200 — Second title');

    await user.clear(within(firstCard).getByLabelText('Title'));
    await user.type(within(firstCard).getByLabelText('Title'), 'Updated title');
    await user.clear(within(secondCard).getByLabelText('Title'));
    await user.type(within(secondCard).getByLabelText('Title'), 'Second updated title');
    fireEvent.change(within(secondCard).getByLabelText('Schedule to date'), {
      target: { value: '2026-03-08' },
    });

    await user.click(within(firstCard).getByRole('button', { name: 'Save title' }));

    expect(within(firstCard).getByText('Saving…')).toBeInTheDocument();
    expect(within(firstCard).getByLabelText('Title')).toBeDisabled();
    expect(within(firstCard).getByRole('button', { name: 'Save title' })).toBeDisabled();
    expect(within(firstCard).getByLabelText('Move to bucket')).toBeDisabled();
    expect(within(firstCard).getByLabelText('Schedule to date')).toBeDisabled();
    expect(within(firstCard).getByRole('button', { name: 'Schedule' })).toBeDisabled();
    expect(within(secondCard).getByLabelText('Title')).toBeDisabled();
    expect(within(secondCard).getByRole('button', { name: 'Save title' })).toBeDisabled();
    expect(within(secondCard).getByLabelText('Move to bucket')).toBeDisabled();
    expect(within(secondCard).getByLabelText('Schedule to date')).toBeDisabled();
    expect(within(secondCard).getByRole('button', { name: 'Schedule' })).toBeDisabled();

    deferredUpdate.resolve({
      id: 'op-1',
      tenantId: 'tenant-a',
      orderId: 'ord-1',
      code: 'OP-100',
      title: 'Updated title',
      status: 'READY',
      sortIndex: 0,
      version: 2,
      dependencyCount: 0,
    });

    await waitFor(() => {
      expect(within(firstCard).queryByText('Saving…')).not.toBeInTheDocument();
      expect(within(firstCard).getByText('OP-100 — Updated title')).toBeInTheDocument();
      expect(within(secondCard).getByLabelText('Title')).toBeEnabled();
      expect(within(secondCard).getByRole('button', { name: 'Save title' })).toBeEnabled();
      expect(within(secondCard).getByLabelText('Move to bucket')).toBeEnabled();
      expect(within(secondCard).getByLabelText('Schedule to date')).toBeEnabled();
      expect(within(secondCard).getByRole('button', { name: 'Schedule' })).toBeEnabled();
    });
  });

  it('ignores a pending inline update response after logout resets the session', async () => {
    const client = createClient();
    const deferredUpdate = createDeferred<{
      id: string;
      tenantId: string;
      orderId: string;
      code: string;
      title: string;
      status: 'READY';
      sortIndex: number;
      version: number;
      dependencyCount: number;
    }>();
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
        dependencyCount: 0,
      },
    ]);
    client.operation.update.mutate.mockReturnValue(deferredUpdate.promise);

    renderWithClient(client);
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();

    const backlogBucket = await screen.findByRole('region', { name: 'Backlog' });
    const operationCard = within(backlogBucket)
      .getByText('OP-100 — Original title')
      .closest('li');

    expect(operationCard).not.toBeNull();

    const titleInput = within(operationCard as HTMLElement).getByLabelText('Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Pending title');
    await user.click(within(operationCard as HTMLElement).getByRole('button', { name: 'Save title' }));

    expect(client.operation.update.mutate).toHaveBeenCalledWith({
      id: 'op-1',
      tenantId: 'tenant-a',
      version: 1,
      title: 'Pending title',
    });
    expect(screen.getByRole('button', { name: 'Load operations' })).toBeDisabled();
    expect(within(operationCard as HTMLElement).getByText('Saving…')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Logout and reset session' }));

    await waitFor(() => {
      expect(window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
      expect(screen.getByText('Logged out')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Load operations' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Logout and reset session' })).not.toBeInTheDocument();
      expect(screen.queryByText('OP-100 — Original title')).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue('Pending title')).not.toBeInTheDocument();
      expect(screen.queryByText('Saving…')).not.toBeInTheDocument();
    });

    deferredUpdate.resolve({
      id: 'op-1',
      tenantId: 'tenant-a',
      orderId: 'ord-1',
      code: 'OP-100',
      title: 'Updated title',
      status: 'READY',
      sortIndex: 0,
      version: 2,
      dependencyCount: 0,
    });

    await waitFor(() => {
      expect(screen.getByText('Logged out')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Load operations' })).toBeDisabled();
      expect(screen.queryByText('OP-100 — Original title')).not.toBeInTheDocument();
      expect(screen.queryByText('OP-100 — Updated title')).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue('Updated title')).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue('Pending title')).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Backlog' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Logout and reset session' })).not.toBeInTheDocument();
    });
  });

  it('clears the non-active card lock when logout resets a pending inline save', async () => {
    const client = createClient();
    const deferredUpdate = createDeferred<never>();
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
        dependencyCount: 0,
      },
      {
        id: 'op-2',
        tenantId: 'tenant-a',
        orderId: 'ord-2',
        code: 'OP-200',
        title: 'Second title',
        status: 'READY',
        sortIndex: 1,
        version: 1,
        dependencyCount: 0,
      },
    ]);
    client.operation.update.mutate.mockReturnValue(deferredUpdate.promise);

    renderWithClient(client);
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();
    const firstCard = getOperationCard('Backlog', 'OP-100 — Original title');
    const secondCard = getOperationCard('Backlog', 'OP-200 — Second title');

    await user.clear(within(firstCard).getByLabelText('Title'));
    await user.type(within(firstCard).getByLabelText('Title'), 'Pending title');
    fireEvent.change(within(secondCard).getByLabelText('Schedule to date'), {
      target: { value: '2026-03-08' },
    });

    await user.click(within(firstCard).getByRole('button', { name: 'Save title' }));

    expect(within(firstCard).getByText('Saving…')).toBeInTheDocument();
    expect(within(secondCard).getByLabelText('Move to bucket')).toBeDisabled();
    expect(within(secondCard).getByLabelText('Schedule to date')).toBeDisabled();
    expect(within(secondCard).getByRole('button', { name: 'Schedule' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Logout and reset session' }));

    await waitFor(() => {
      expect(screen.getByText('Logged out')).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Backlog' })).not.toBeInTheDocument();
      expect(screen.queryByText('Saving…')).not.toBeInTheDocument();
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
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();

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
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();

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
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();

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
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();

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
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();

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
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();

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
    await loginAndWaitForAutoLoad(client);

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

  it('reloads operations exactly once and shows the resync message when a direct bucket move hits a version conflict', async () => {
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
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();

    const backlogBucket = await screen.findByRole('region', { name: 'Backlog' });
    const operationCard = within(backlogBucket)
      .getByText('OP-100 — Backlog item')
      .closest('li');

    expect(operationCard).not.toBeNull();

    await user.selectOptions(within(operationCard as HTMLElement).getByLabelText('Move to bucket'), '2026-03-06');

    expect(client.operation.update.mutate).toHaveBeenCalledTimes(1);
    expect(client.operation.update.mutate).toHaveBeenCalledWith({
      id: 'op-1',
      tenantId: 'tenant-a',
      version: 1,
      startDate: '2026-03-06T00:00:00.000Z',
    });

    expect(
      await screen.findByText('Board was out of date. Reloaded latest operations, please try again.'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(client.operation.list.query).toHaveBeenCalledTimes(2);
      const dateBucket = screen.getByRole('region', { name: '2026-03-06' });
      expect(within(dateBucket).getByText('OP-100 — Backlog item')).toBeInTheDocument();
    });
  });

  it('reloads operations exactly once and shows the resync message when schedule to date hits a version conflict', async () => {
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
          startDate: '2026-03-08T00:00:00.000Z',
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
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();

    const backlogBucket = await screen.findByRole('region', { name: 'Backlog' });
    const operationCard = within(backlogBucket)
      .getByText('OP-100 — Backlog item')
      .closest('li');

    expect(operationCard).not.toBeNull();

    fireEvent.change(within(operationCard as HTMLElement).getByLabelText('Schedule to date'), {
      target: { value: '2026-03-08' },
    });
    await user.click(within(operationCard as HTMLElement).getByRole('button', { name: 'Schedule' }));

    expect(client.operation.update.mutate).toHaveBeenCalledTimes(1);
    expect(client.operation.update.mutate).toHaveBeenCalledWith({
      id: 'op-1',
      tenantId: 'tenant-a',
      version: 1,
      startDate: '2026-03-08T00:00:00.000Z',
    });

    expect(
      await screen.findByText('Board was out of date. Reloaded latest operations, please try again.'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(client.operation.list.query).toHaveBeenCalledTimes(2);
      const dateBucket = screen.getByRole('region', { name: '2026-03-08' });
      const refreshedCard = within(dateBucket).getByText('OP-100 — Backlog item').closest('li');

      expect(refreshedCard).not.toBeNull();
      expect(within(refreshedCard as HTMLElement).getByLabelText('Schedule to date')).toHaveValue('2026-03-08');
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
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();

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
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();

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
    const deferredUpdate = createDeferred<never>();
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
    client.operation.update.mutate.mockReturnValue(deferredUpdate.promise);

    renderWithClient(client);
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();

    const backlogBucket = await screen.findByRole('region', { name: 'Backlog' });
    const operationCard = within(backlogBucket)
      .getByText('OP-100 — Original title')
      .closest('li');

    expect(operationCard).not.toBeNull();

    const titleInput = within(operationCard as HTMLElement).getByLabelText('Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Client edited title');
    await user.click(within(operationCard as HTMLElement).getByRole('button', { name: 'Save title' }));

    expect(within(operationCard as HTMLElement).getByText('Saving…')).toBeInTheDocument();

    deferredUpdate.reject({
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
      expect(within(refreshedCard as HTMLElement).queryByText('Saving…')).not.toBeInTheDocument();
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
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();

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
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();

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
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();

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
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();

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
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();

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
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();

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
    await loginAndWaitForAutoLoad(client);

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
    await loginAndWaitForAutoLoad(client);

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
    await loginAndWaitForAutoLoad(client);

    const user = userEvent.setup();

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

  it('expires the session when planner role auto-load is forbidden', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-planner' });
    client.operation.list.query.mockRejectedValue({ data: { code: 'FORBIDDEN' } });

    renderWithClient(client);
    await loginAndWaitForAutoLoad(client, 'planner@tenant-a.local', 'tenant-a-pass');

    expect(await screen.findByText('Session expired. Please log in again.')).toBeInTheDocument();
    expect(window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
    expect(screen.getByRole('button', { name: 'Load operations' })).toBeDisabled();
  });

  it('shows operation error state', async () => {
    const client = createClient();
    client.auth.login.mutate.mockResolvedValue({ accessToken: 'token-owner' });
    client.operation.list.query.mockRejectedValue(new Error('boom'));

    renderWithClient(client);
    await loginAndWaitForAutoLoad(client);

    expect(await screen.findByText('Failed to load operations.')).toBeInTheDocument();
  });
});
