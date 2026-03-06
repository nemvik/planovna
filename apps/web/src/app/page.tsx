"use client";

import { FormEvent, useMemo, useState } from 'react';
import { createTrpcClient } from '../lib/trpc/client';

type Invoice = {
  id: string;
  tenantId: string;
  orderId: string;
  number: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID';
  currency: 'CZK' | 'EUR';
  amountGross: number;
  dueAt?: string;
  paidAt?: string;
};

type Cashflow = {
  id: string;
  tenantId: string;
  invoiceId: string;
  kind: 'PLANNED_IN' | 'ACTUAL_IN';
  amount: number;
  currency: 'CZK' | 'EUR';
  date: string;
};

type LoadState = 'idle' | 'loading' | 'loaded' | 'empty' | 'forbidden' | 'error';

const hasForbiddenCode = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    data?: { code?: string };
    shape?: { data?: { code?: string } };
  };

  return candidate.data?.code === 'FORBIDDEN' || candidate.shape?.data?.code === 'FORBIDDEN';
};

export default function Home() {
  const [email, setEmail] = useState('owner@tenant-a.local');
  const [password, setPassword] = useState('tenant-a-pass');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [cashflow, setCashflow] = useState<Cashflow[]>([]);
  const [authMessage, setAuthMessage] = useState('');
  const [invoiceLoadState, setInvoiceLoadState] = useState<LoadState>('idle');
  const [cashflowLoadState, setCashflowLoadState] = useState<LoadState>('idle');

  const trpcClient = useMemo(
    () => createTrpcClient(accessToken ?? undefined),
    [accessToken],
  );

  const onLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthMessage('');

    try {
      const result = await trpcClient.auth.login.mutate({ email, password });
      setAccessToken(result.accessToken);
      setInvoices([]);
      setCashflow([]);
      setInvoiceLoadState('idle');
      setCashflowLoadState('idle');
      setAuthMessage('Logged in');
    } catch {
      setAccessToken(null);
      setInvoices([]);
      setCashflow([]);
      setInvoiceLoadState('idle');
      setCashflowLoadState('idle');
      setAuthMessage('Invalid credentials');
    }
  };

  const onLoadInvoices = async () => {
    setInvoiceLoadState('loading');

    try {
      const result = await trpcClient.invoice.list.query();
      const loadedInvoices = result as Invoice[];
      setInvoices(loadedInvoices);
      setInvoiceLoadState(loadedInvoices.length > 0 ? 'loaded' : 'empty');
    } catch (error) {
      setInvoices([]);
      setInvoiceLoadState(hasForbiddenCode(error) ? 'forbidden' : 'error');
    }
  };

  const onLoadCashflow = async () => {
    setCashflowLoadState('loading');

    try {
      const result = await trpcClient.cashflow.list.query();
      const loadedCashflow = result as Cashflow[];
      setCashflow(loadedCashflow);
      setCashflowLoadState(loadedCashflow.length > 0 ? 'loaded' : 'empty');
    } catch (error) {
      setCashflow([]);
      setCashflowLoadState(hasForbiddenCode(error) ? 'forbidden' : 'error');
    }
  };

  const controlsDisabled = !accessToken;

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

      <div className="flex gap-2">
        <button
          className="rounded border px-3 py-2 disabled:opacity-50"
          type="button"
          disabled={controlsDisabled || invoiceLoadState === 'loading'}
          onClick={onLoadInvoices}
        >
          {invoiceLoadState === 'loading' ? 'Loading invoices…' : 'Load invoices'}
        </button>

        <button
          className="rounded border px-3 py-2 disabled:opacity-50"
          type="button"
          disabled={controlsDisabled || cashflowLoadState === 'loading'}
          onClick={onLoadCashflow}
        >
          {cashflowLoadState === 'loading' ? 'Loading cashflow…' : 'Load cashflow'}
        </button>
      </div>

      {authMessage ? <p>{authMessage}</p> : null}

      {invoiceLoadState === 'loading' ? <p>Loading invoices…</p> : null}
      {invoiceLoadState === 'empty' ? <p>No invoices found.</p> : null}
      {invoiceLoadState === 'forbidden' ? (
        <p>Forbidden: your role is not allowed to view invoices.</p>
      ) : null}
      {invoiceLoadState === 'error' ? <p>Failed to load invoices.</p> : null}

      {cashflowLoadState === 'loading' ? <p>Loading cashflow…</p> : null}
      {cashflowLoadState === 'empty' ? <p>No cashflow entries found.</p> : null}
      {cashflowLoadState === 'forbidden' ? (
        <p>Forbidden: your role is not allowed to view cashflow.</p>
      ) : null}
      {cashflowLoadState === 'error' ? <p>Failed to load cashflow.</p> : null}

      {invoiceLoadState === 'loaded' ? (
        <ul className="list-disc pl-5">
          {invoices.map((invoice) => (
            <li key={invoice.id}>
              <div>
                {invoice.number} — {invoice.status} — {invoice.amountGross} {invoice.currency}
              </div>
              {invoice.dueAt ? <div>Due at: {invoice.dueAt}</div> : null}
              {invoice.paidAt ? <div>Paid at: {invoice.paidAt}</div> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {cashflowLoadState === 'loaded' ? (
        <ul className="list-disc pl-5">
          {cashflow.map((entry) => (
            <li key={entry.id}>
              {entry.kind} — {entry.amount} {entry.currency} — {entry.date}
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
