"use client";

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  applyBoardFilters,
  BACKLOG_BUCKET,
  BOARD_STATUS_VALUES,
  compareBucketLabels,
  getAvailableBucketFilters,
  getOperationBucketLabel,
  type BoardFilters,
  type BucketFilter,
  parseBoardFilters,
  serializeBoardFilters,
} from './board-filters';
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

type ConflictData = {
  code?: string;
  entity?: string;
  id?: string;
  expectedVersion?: number;
  actualVersion?: number;
};

const defaultBoardFilters = (): BoardFilters => {
  if (typeof window === 'undefined') {
    return { status: 'ALL', bucket: 'ALL' };
  }

  return parseBoardFilters(new URLSearchParams(window.location.search));
};

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

const extractConflictData = (error: unknown): ConflictData | null => {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const candidate = error as {
    data?: { code?: string; conflict?: ConflictData };
    shape?: { data?: { code?: string; conflict?: ConflictData } };
  };

  const conflict = candidate.data?.conflict ?? candidate.shape?.data?.conflict;
  const code = candidate.data?.code ?? candidate.shape?.data?.code;

  if (code !== 'CONFLICT' || !conflict) {
    return null;
  }

  return conflict;
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
    const bucketLabel = getOperationBucketLabel(operation.startDate);
    const bucketOperations = bucketMap.get(bucketLabel) ?? [];
    bucketOperations.push(operation);
    bucketMap.set(bucketLabel, bucketOperations);
  }

  return Array.from(bucketMap.entries())
    .sort(([leftLabel], [rightLabel]) => compareBucketLabels(leftLabel, rightLabel))
    .map(([label, bucketOperations]) => ({
      label,
      operations: [...bucketOperations].sort(compareOperations),
    }));
};

const toStartDate = (bucketLabel: BucketFilter) =>
  bucketLabel === BACKLOG_BUCKET ? undefined : `${bucketLabel}T00:00:00.000Z`;

const isDateBucket = (value: string): value is Exclude<BucketFilter, 'ALL' | typeof BACKLOG_BUCKET> =>
  /^\d{4}-\d{2}-\d{2}$/.test(value);

const getScheduledDateValue = (operation: Operation, scheduleDates: Record<string, string>) =>
  scheduleDates[operation.id] ?? operation.startDate?.slice(0, 10) ?? '';

export default function Home() {
  const [email, setEmail] = useState('owner@tenant-a.local');
  const [password, setPassword] = useState('tenant-a-pass');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [authMessage, setAuthMessage] = useState('');
  const [boardMessage, setBoardMessage] = useState('');
  const [operationLoadState, setOperationLoadState] = useState<LoadState>('idle');
  const [movingOperationId, setMovingOperationId] = useState<string | null>(null);
  const [scheduleDates, setScheduleDates] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<BoardFilters>(defaultBoardFilters);

  const trpcClient = useMemo(
    () => createTrpcClient(accessToken ?? undefined),
    [accessToken],
  );

  const availableBucketFilters = useMemo(() => getAvailableBucketFilters(operations), [operations]);
  const moveBucketOptions = useMemo(
    () => availableBucketFilters.filter((bucket): bucket is Exclude<BucketFilter, 'ALL'> => bucket !== 'ALL'),
    [availableBucketFilters],
  );
  const filteredOperations = useMemo(() => applyBoardFilters(operations, filters), [operations, filters]);
  const operationBuckets = useMemo(() => buildBuckets(filteredOperations), [filteredOperations]);

  useEffect(() => {
    if (
      operationLoadState === 'loaded' &&
      filters.bucket !== 'ALL' &&
      !availableBucketFilters.includes(filters.bucket)
    ) {
      setFilters((currentFilters) => ({ ...currentFilters, bucket: 'ALL' }));
    }
  }, [availableBucketFilters, filters.bucket, operationLoadState]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const nextSearchParams = serializeBoardFilters(
      filters,
      new URLSearchParams(window.location.search),
    );
    const nextQuery = nextSearchParams.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;

    window.history.replaceState(window.history.state, '', nextUrl);
  }, [filters]);

  const resetOperationsState = () => {
    setOperations([]);
    setBoardMessage('');
    setMovingOperationId(null);
    setScheduleDates({});
    setOperationLoadState('idle');
  };

  const loadOperations = async () => {
    setOperationLoadState('loading');

    try {
      const result = await trpcClient.operation.list.query();
      const loadedOperations = result as Operation[];
      setOperations(loadedOperations);
      setOperationLoadState(loadedOperations.length > 0 ? 'loaded' : 'empty');
      return loadedOperations;
    } catch (error) {
      setOperations([]);
      setOperationLoadState(hasForbiddenCode(error) ? 'forbidden' : 'error');
      throw error;
    }
  };

  const onLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthMessage('');

    try {
      const result = await trpcClient.auth.login.mutate({ email, password });
      setAccessToken(result.accessToken);
      resetOperationsState();
      setAuthMessage('Logged in');
    } catch {
      setAccessToken(null);
      resetOperationsState();
      setAuthMessage('Invalid credentials');
    }
  };

  const onLoadOperations = async () => {
    try {
      await loadOperations();
    } catch {
      // state is already updated in loadOperations
    }
  };

  const onMoveOperation = async (operation: Operation, bucketLabel: Exclude<BucketFilter, 'ALL'>) => {
    const nextStartDate = toStartDate(bucketLabel);

    if (nextStartDate === operation.startDate) {
      return;
    }

    setBoardMessage('');
    setMovingOperationId(operation.id);

    try {
      const updatedOperation = (await trpcClient.operation.update.mutate({
        id: operation.id,
        tenantId: operation.tenantId,
        version: operation.version,
        startDate: nextStartDate,
      })) as Operation;

      setOperations((currentOperations) =>
        currentOperations.map((currentOperation) =>
          currentOperation.id === updatedOperation.id ? updatedOperation : currentOperation,
        ),
      );
      setScheduleDates((currentScheduleDates) => ({
        ...currentScheduleDates,
        [updatedOperation.id]: updatedOperation.startDate?.slice(0, 10) ?? '',
      }));
    } catch (error) {
      if (extractConflictData(error)) {
        try {
          await loadOperations();
          setBoardMessage('Board was out of date. Reloaded latest operations, please try again.');
        } catch {
          setBoardMessage('Board was out of date and reload failed. Please reload operations again.');
        }
      } else {
        setBoardMessage('Failed to move operation.');
      }
    } finally {
      setMovingOperationId(null);
    }
  };

  const onScheduleOperation = async (event: FormEvent<HTMLFormElement>, operation: Operation) => {
    event.preventDefault();

    const selectedDate = getScheduledDateValue(operation, scheduleDates);

    if (!isDateBucket(selectedDate)) {
      return;
    }

    await onMoveOperation(operation, selectedDate);
  };

  const controlsDisabled = !accessToken;

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 p-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Planovna operations board</h1>
        <p className="text-sm text-slate-600">
          Lightweight planning board for moving operations between backlog and loaded start-date buckets.
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
      {boardMessage ? <p>{boardMessage}</p> : null}

      {operationLoadState === 'loading' ? <p>Loading operations…</p> : null}
      {operationLoadState === 'empty' ? <p>No operations found.</p> : null}
      {operationLoadState === 'forbidden' ? (
        <p>Forbidden: your role is not allowed to view operations.</p>
      ) : null}
      {operationLoadState === 'error' ? <p>Failed to load operations.</p> : null}

      {operationLoadState === 'loaded' ? (
        <>
          <div className="flex flex-wrap items-end gap-3 rounded border bg-slate-50 p-4">
            <label className="flex flex-col gap-1 text-sm">
              Status
              <select
                className="rounded border bg-white px-2 py-1"
                value={filters.status}
                onChange={(event) =>
                  setFilters((currentFilters) => ({
                    ...currentFilters,
                    status: event.target.value as BoardFilters['status'],
                  }))
                }
              >
                <option value="ALL">All</option>
                {BOARD_STATUS_VALUES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Date bucket
              <select
                className="rounded border bg-white px-2 py-1"
                value={filters.bucket}
                onChange={(event) =>
                  setFilters((currentFilters) => ({
                    ...currentFilters,
                    bucket: event.target.value as BoardFilters['bucket'],
                  }))
                }
              >
                {availableBucketFilters.map((bucket) => (
                  <option key={bucket} value={bucket}>
                    {bucket === 'ALL' ? 'All' : bucket}
                  </option>
                ))}
              </select>
            </label>
          </div>

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
                  {bucket.operations.map((operation) => {
                    const scheduledDateValue = getScheduledDateValue(operation, scheduleDates);
                    const canSchedule =
                      isDateBucket(scheduledDateValue) && scheduledDateValue !== operation.startDate?.slice(0, 10);

                    return (
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
                        <label className="mt-3 flex flex-col gap-1 text-sm">
                          Move to bucket
                          <select
                            className="rounded border bg-white px-2 py-1"
                            value={getOperationBucketLabel(operation.startDate)}
                            disabled={movingOperationId !== null}
                            onChange={(event) =>
                              void onMoveOperation(
                                operation,
                                event.target.value as Exclude<BucketFilter, 'ALL'>,
                              )
                            }
                          >
                            {moveBucketOptions.map((moveBucket) => (
                              <option key={moveBucket} value={moveBucket}>
                                {moveBucket}
                              </option>
                            ))}
                          </select>
                        </label>
                        <form
                          className="mt-3 flex items-end gap-2"
                          onSubmit={(event) => void onScheduleOperation(event, operation)}
                        >
                          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                            Schedule to date
                            <input
                              className="rounded border bg-white px-2 py-1"
                              type="date"
                              value={scheduledDateValue}
                              disabled={movingOperationId !== null}
                              onChange={(event) =>
                                setScheduleDates((currentScheduleDates) => ({
                                  ...currentScheduleDates,
                                  [operation.id]: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <button
                            className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
                            type="submit"
                            disabled={movingOperationId !== null || !canSchedule}
                          >
                            Schedule
                          </button>
                        </form>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>
      ) : null}
    </main>
  );
}
