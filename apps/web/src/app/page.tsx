"use client";

import { FormEvent, useMemo, useState } from 'react';
import { createTrpcClient } from '../lib/trpc/client';

type Operation = {
  id: string;
  tenantId: string;
  orderId: string;
  code: string;
  title: string;
  status: 'READY' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';
  startDate?: string;
  endDate?: string;
  sortIndex: number;
  blockedReason?: string;
  version: number;
};

type LoadState = 'idle' | 'loading' | 'loaded' | 'empty' | 'forbidden' | 'error';

type OperationBucket = {
  label: string;
  operations: Operation[];
};

const BACKLOG_BUCKET = 'Backlog';

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

const compareOperations = (left: Operation, right: Operation) => {
  if (left.sortIndex !== right.sortIndex) {
    return left.sortIndex - right.sortIndex;
  }

  const leftFallback = left.code || left.id;
  const rightFallback = right.code || right.id;

  return leftFallback.localeCompare(rightFallback);
};

const buildBuckets = (operations: Operation[]): OperationBucket[] => {
  const bucketMap = new Map<string, Operation[]>();

  for (const operation of operations) {
    const bucketLabel = operation.startDate?.slice(0, 10) || BACKLOG_BUCKET;
    const bucketOperations = bucketMap.get(bucketLabel) ?? [];
    bucketOperations.push(operation);
    bucketMap.set(bucketLabel, bucketOperations);
  }

  return Array.from(bucketMap.entries())
    .sort(([leftLabel], [rightLabel]) => {
      if (leftLabel === BACKLOG_BUCKET) {
        return -1;
      }

      if (rightLabel === BACKLOG_BUCKET) {
        return 1;
      }

      return leftLabel.localeCompare(rightLabel);
    })
    .map(([label, bucketOperations]) => ({
      label,
      operations: [...bucketOperations].sort(compareOperations),
    }));
};

export default function Home() {
  const [email, setEmail] = useState('owner@tenant-a.local');
  const [password, setPassword] = useState('tenant-a-pass');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [authMessage, setAuthMessage] = useState('');
  const [operationLoadState, setOperationLoadState] = useState<LoadState>('idle');

  const trpcClient = useMemo(
    () => createTrpcClient(accessToken ?? undefined),
    [accessToken],
  );

  const operationBuckets = useMemo(() => buildBuckets(operations), [operations]);

  const onLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthMessage('');

    try {
      const result = await trpcClient.auth.login.mutate({ email, password });
      setAccessToken(result.accessToken);
      setOperations([]);
      setOperationLoadState('idle');
      setAuthMessage('Logged in');
    } catch {
      setAccessToken(null);
      setOperations([]);
      setOperationLoadState('idle');
      setAuthMessage('Invalid credentials');
    }
  };

  const onLoadOperations = async () => {
    setOperationLoadState('loading');

    try {
      const result = await trpcClient.operation.list.query();
      const loadedOperations = result as Operation[];
      setOperations(loadedOperations);
      setOperationLoadState(loadedOperations.length > 0 ? 'loaded' : 'empty');
    } catch (error) {
      setOperations([]);
      setOperationLoadState(hasForbiddenCode(error) ? 'forbidden' : 'error');
    }
  };

  const controlsDisabled = !accessToken;

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 p-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Planovna operations board</h1>
        <p className="text-sm text-slate-600">
          Read-only board preview for planning operations by backlog and start date.
        </p>
      </div>

      <form className="flex max-w-sm flex-col gap-2" onSubmit={onLogin}>
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

      <div className="flex items-center gap-2">
        <button
          className="rounded border px-3 py-2 disabled:opacity-50"
          type="button"
          disabled={controlsDisabled || operationLoadState === 'loading'}
          onClick={onLoadOperations}
        >
          {operationLoadState === 'loading' ? 'Loading operations…' : 'Load operations'}
        </button>
      </div>

      {authMessage ? <p>{authMessage}</p> : null}

      {operationLoadState === 'loading' ? <p>Loading operations…</p> : null}
      {operationLoadState === 'empty' ? <p>No operations found.</p> : null}
      {operationLoadState === 'forbidden' ? (
        <p>Forbidden: your role is not allowed to view operations.</p>
      ) : null}
      {operationLoadState === 'error' ? <p>Failed to load operations.</p> : null}

      {operationLoadState === 'loaded' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {operationBuckets.map((bucket) => (
            <section
              key={bucket.label}
              aria-label={bucket.label}
              className="rounded border bg-slate-50 p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-lg font-medium">{bucket.label}</h2>
                <span className="text-sm text-slate-500">{bucket.operations.length}</span>
              </div>

              <ul className="space-y-2">
                {bucket.operations.map((operation) => (
                  <li key={operation.id} className="rounded border bg-white p-3">
                    <div className="font-medium">
                      {operation.code} — {operation.title}
                    </div>
                    <div className="text-sm text-slate-600">
                      {operation.status} · sort {operation.sortIndex}
                    </div>
                    {operation.blockedReason ? (
                      <div className="text-sm text-amber-700">
                        Blocked: {operation.blockedReason}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </main>
  );
}
