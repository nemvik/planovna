import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrdersPage from './page';
import { createTrpcClient } from '../../lib/trpc/client';
import { HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY } from '../home-workspace';

jest.mock('../../lib/trpc/client', () => ({
  createTrpcClient: jest.fn(),
}));

const createClient = () => ({
  order: {
    list: { query: jest.fn() },
  },
});

describe('orders workspace v1', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  it('shows the login workspace before authentication', () => {
    render(<OrdersPage />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Orders' })).not.toBeInTheDocument();
  });

  it('renders the orders workspace with summary, filters, and planning continuation after loading', async () => {
    const client = createClient();
    client.order.list.query.mockResolvedValue([
      {
        id: 'ord-1',
        tenantId: 'tenant-a',
        customerId: 'cust-a',
        code: 'ORD-1001',
        title: 'Kitchen production batch',
        status: 'READY',
        dueDate: '2026-04-20T00:00:00.000Z',
        notes: 'Pilot customer delivery',
        version: 1,
      },
      {
        id: 'ord-2',
        tenantId: 'tenant-a',
        customerId: 'cust-b',
        code: 'ORD-1002',
        title: 'Showroom cabinet refresh',
        status: 'BLOCKED',
        version: 2,
      },
    ]);

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;
    createTrpcClientMock.mockImplementation(() => client as never);

    render(<OrdersPage />);

    await waitFor(() => {
      expect(client.order.list.query).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('heading', { name: 'Orders' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Board' })).toHaveAttribute('href', '/board');
    expect(screen.getByText('All orders')).toBeInTheDocument();
    expect(screen.getByText('ORD-1001')).toBeInTheDocument();
    expect(screen.getByText('Kitchen production batch')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Continue in planning' })[0]).toHaveAttribute('href', '/board');
  });

  it('filters the loaded list by search and status', async () => {
    const client = createClient();
    client.order.list.query.mockResolvedValue([
      {
        id: 'ord-1',
        tenantId: 'tenant-a',
        customerId: 'cust-a',
        code: 'ORD-1001',
        title: 'Kitchen production batch',
        status: 'READY',
        version: 1,
      },
      {
        id: 'ord-2',
        tenantId: 'tenant-a',
        customerId: 'cust-b',
        code: 'ORD-1002',
        title: 'Showroom cabinet refresh',
        status: 'BLOCKED',
        version: 2,
      },
    ]);

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;
    createTrpcClientMock.mockImplementation(() => client as never);

    render(<OrdersPage />);

    await waitFor(() => {
      expect(client.order.list.query).toHaveBeenCalledTimes(1);
    });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Search orders'), 'Showroom');

    expect(screen.queryByText('ORD-1001')).not.toBeInTheDocument();
    expect(screen.getByText('ORD-1002')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Search orders'));
    await user.selectOptions(screen.getByLabelText('Status'), 'READY');

    expect(screen.getByText('ORD-1001')).toBeInTheDocument();
    expect(screen.queryByText('ORD-1002')).not.toBeInTheDocument();
  });

  it('shows explicit empty, error, and no-results states', async () => {
    const emptyClient = createClient();
    emptyClient.order.list.query.mockResolvedValue([]);
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;

    window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, 'token-owner');
    createTrpcClientMock.mockImplementationOnce(() => emptyClient as never);
    const { unmount } = render(<OrdersPage />);

    await waitFor(() => {
      expect(emptyClient.order.list.query).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText('No orders are available yet.')).toBeInTheDocument();
    });
    unmount();

    const loadedClient = createClient();
    loadedClient.order.list.query.mockResolvedValue([
      {
        id: 'ord-1',
        tenantId: 'tenant-a',
        customerId: 'cust-a',
        code: 'ORD-1001',
        title: 'Kitchen production batch',
        status: 'READY',
        version: 1,
      },
    ]);
    createTrpcClientMock.mockImplementationOnce(() => loadedClient as never);
    const loadedRender = render(<OrdersPage />);

    await waitFor(() => {
      expect(loadedClient.order.list.query).toHaveBeenCalledTimes(1);
    });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Search orders'), 'missing');
    await waitFor(() => {
      expect(screen.getByText('No orders match the current filters.')).toBeInTheDocument();
    });
    loadedRender.unmount();

    const errorClient = createClient();
    errorClient.order.list.query.mockRejectedValue(new Error('load failed'));
    createTrpcClientMock.mockImplementationOnce(() => errorClient as never);
    render(<OrdersPage />);

    await waitFor(() => {
      expect(errorClient.order.list.query).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText('Orders could not be loaded right now.')).toBeInTheDocument();
    });
  });
});
