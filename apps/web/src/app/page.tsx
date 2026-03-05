"use client";

import { FormEvent, useMemo, useState } from 'react';
import { createTrpcClient } from '../lib/trpc/client';

type Customer = {
  id: string;
  name: string;
  email: string;
  tenantId: string;
};

export default function Home() {
  const [email, setEmail] = useState('owner@tenant-a.local');
  const [password, setPassword] = useState('tenant-a-pass');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [message, setMessage] = useState('');

  const trpcClient = useMemo(
    () => createTrpcClient(accessToken ?? undefined),
    [accessToken],
  );

  const onLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');

    try {
      const result = await trpcClient.auth.login.mutate({ email, password });
      setAccessToken(result.accessToken);
      setMessage('Logged in');
    } catch {
      setAccessToken(null);
      setCustomers([]);
      setMessage('Invalid credentials');
    }
  };

  const onLoadCustomers = async () => {
    setMessage('');

    try {
      const result = await trpcClient.customer.list.query();
      setCustomers(result as Customer[]);
      setMessage(`Loaded ${result.length} customers`);
    } catch {
      setCustomers([]);
      setMessage('Failed to load customers');
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Planovna tRPC demo</h1>

      <form className="flex flex-col gap-2" onSubmit={onLogin}>
        <label className="flex flex-col gap-1">
          Email
          <input
            className="rounded border px-2 py-1"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          Password
          <input
            className="rounded border px-2 py-1"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <button className="rounded bg-black px-3 py-2 text-white" type="submit">
          Login
        </button>
      </form>

      <button
        className="rounded border px-3 py-2 disabled:opacity-50"
        type="button"
        disabled={!accessToken}
        onClick={onLoadCustomers}
      >
        Load customers
      </button>

      {message ? <p>{message}</p> : null}

      <ul className="list-disc pl-5">
        {customers.map((customer) => (
          <li key={customer.id}>
            {customer.name} ({customer.email})
          </li>
        ))}
      </ul>
    </main>
  );
}
