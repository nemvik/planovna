import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterPage from './page';
import { createTrpcClient } from '../../lib/trpc/client';
import { HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY } from '../home-workspace';

const pushMock = jest.fn();
const replaceMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
}));

jest.mock('../../lib/trpc/client', () => ({
  createTrpcClient: jest.fn(),
}));

const createClient = () => ({
  auth: {
    register: { mutate: jest.fn() },
  },
});

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
};

describe('register page', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  it('renders the public owner registration surface', async () => {
    render(<RegisterPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
    });

    expect(screen.getByText('Create an Owner account and Planovna will create your workspace automatically.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/)).toBeInTheDocument();
    expect(screen.getByLabelText('Company / workspace name')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/board');
  });

  it('validates required fields and current minimum contract rules before submit', async () => {
    render(<RegisterPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Email is required.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Email'), 'owner');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Email'));
    await user.type(screen.getByLabelText('Email'), 'owner@example.test');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Password is required.')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^Password/), 'strongpass');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Company / workspace name is required.')).toBeInTheDocument();
  });

  it('shows inline loading, registers successfully, and continues signed in', async () => {
    const client = createClient();
    const deferred = createDeferred<{ accessToken: string }>();
    client.auth.register.mutate.mockReturnValue(deferred.promise);
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;
    createTrpcClientMock.mockImplementation(() => client as never);

    render(<RegisterPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'owner@example.test');
    await user.type(screen.getByLabelText(/^Password/), 'strongpass');
    await user.type(screen.getByLabelText('Company / workspace name'), 'Foundry One');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByRole('button', { name: 'Creating account…' })).toBeInTheDocument();

    await waitFor(() => {
      expect(client.auth.register.mutate).toHaveBeenCalledWith({
        email: 'owner@example.test',
        password: 'strongpass',
        companyName: 'Foundry One',
      });
    });

    deferred.resolve({ accessToken: 'token-owner' });

    await waitFor(() => {
      expect(window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY)).toBe('token-owner');
    });

    expect(pushMock).toHaveBeenCalledWith('/');
  });

  it('shows duplicate-email, rate-limit, and generic failures truthfully', async () => {
    const createTrpcClientMock = createTrpcClient as jest.MockedFunction<typeof createTrpcClient>;

    const duplicateClient = createClient();
    duplicateClient.auth.register.mutate.mockRejectedValue({ data: { code: 'CONFLICT' } });
    createTrpcClientMock.mockImplementationOnce(() => duplicateClient as never);
    const duplicateRender = render(<RegisterPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
    });

    let user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'owner@example.test');
    await user.type(screen.getByLabelText(/^Password/), 'strongpass');
    await user.type(screen.getByLabelText('Company / workspace name'), 'Foundry One');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => {
      expect(screen.getByText('This email is already registered. Please log in instead.')).toBeInTheDocument();
    });

    duplicateRender.unmount();

    const rateLimitedClient = createClient();
    rateLimitedClient.auth.register.mutate.mockRejectedValue({ data: { code: 'TOO_MANY_REQUESTS' } });
    createTrpcClientMock.mockImplementationOnce(() => rateLimitedClient as never);
    const rateLimitRender = render(<RegisterPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
    });

    user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'owner2@example.test');
    await user.type(screen.getByLabelText(/^Password/), 'strongpass');
    await user.type(screen.getByLabelText('Company / workspace name'), 'Foundry Two');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => {
      expect(screen.getByText('Too many registration attempts. Please try again later.')).toBeInTheDocument();
    });

    rateLimitRender.unmount();

    const genericClient = createClient();
    genericClient.auth.register.mutate.mockRejectedValue(new Error('boom'));
    createTrpcClientMock.mockImplementationOnce(() => genericClient as never);
    render(<RegisterPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
    });

    user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'owner3@example.test');
    await user.type(screen.getByLabelText(/^Password/), 'strongpass');
    await user.type(screen.getByLabelText('Company / workspace name'), 'Foundry Three');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => {
      expect(screen.getByText('Could not create your account. Please try again.')).toBeInTheDocument();
    });
  });
});
