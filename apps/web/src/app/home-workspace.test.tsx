import { render, screen } from '@testing-library/react';
import Home from './home-workspace';
import { createTrpcClient } from '../lib/trpc/client';

jest.mock('../lib/trpc/client', () => ({
  createTrpcClient: jest.fn(),
}));

const createClient = () => ({
  auth: {
    login: { mutate: jest.fn() },
    register: { mutate: jest.fn() },
  },
  operation: {
    list: { query: jest.fn().mockResolvedValue([]) },
    update: { mutate: jest.fn() },
    auditLog: { query: jest.fn().mockResolvedValue([]) },
    listBoardColumns: { query: jest.fn().mockResolvedValue([]) },
    saveBoardColumns: { mutate: jest.fn() },
  },
  order: {
    list: { query: jest.fn().mockResolvedValue([]) },
    routingTemplates: { query: jest.fn().mockResolvedValue([]) },
  },
  cashflow: {
    list: { query: jest.fn().mockResolvedValue([]) },
    listRecurringRules: { query: jest.fn().mockResolvedValue([]) },
  },
  invoice: {
    list: { query: jest.fn().mockResolvedValue([]) },
  },
});

describe('extracted shared workspace harness', () => {
  it('mounts the shared workspace contract instead of the dashboard shell', () => {
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;
    createTrpcClientMock.mockImplementation(() => createClient() as never);

    render(<Home />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Continue in Board' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open Invoices' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open Cashflow' })).not.toBeInTheDocument();
  });
});
