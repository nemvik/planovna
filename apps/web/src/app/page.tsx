"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyBoardFilters,
  BACKLOG_BUCKET,
  BOARD_STATUS_VALUES,
  clearBoardFilter,
  compareBucketLabels,
  getActiveBoardFilters,
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
  dependencyCount: number;
  prerequisiteCodes?: string[];
  prerequisiteOverflowCount?: number;
};

type LoadState = 'idle' | 'loading' | 'loaded' | 'empty' | 'forbidden' | 'error';

type OperationBucket = {
  label: string;
  operations: Operation[];
};

type OperationUpdate = Partial<
  Pick<Operation, 'startDate' | 'status' | 'sortIndex' | 'title' | 'code'>
> & {
  blockedReason?: string | null;
  endDate?: string | null;
};

type ConflictData = {
  code?: string;
  entity?: string;
  id?: string;
  expectedVersion?: number;
  actualVersion?: number;
};

const DEFAULT_BOARD_FILTERS: BoardFilters = {
  status: 'ALL',
  bucket: 'ALL',
  query: '',
};

const HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY = 'planovna.homepage.accessToken';
const SESSION_EXPIRED_AUTH_MESSAGE = 'Session expired. Please log in again.';

const defaultBoardFilters = (): BoardFilters => {
  if (typeof window === 'undefined') {
    return DEFAULT_BOARD_FILTERS;
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

const getEndDateValue = (operation: Operation, endDateDrafts: Record<string, string>) =>
  endDateDrafts[operation.id] ?? operation.endDate?.slice(0, 10) ?? '';

const getBlockedReasonValue = (operation: Operation, blockedReasonDrafts: Record<string, string>) =>
  blockedReasonDrafts[operation.id] ?? operation.blockedReason ?? '';

const getTitleValue = (operation: Operation, titleDrafts: Record<string, string>) =>
  titleDrafts[operation.id] ?? operation.title;

const getCodeValue = (operation: Operation, codeDrafts: Record<string, string>) =>
  codeDrafts[operation.id] ?? operation.code;

const getSortIndexValue = (operation: Operation, sortIndexDrafts: Record<string, string>) =>
  sortIndexDrafts[operation.id] ?? String(operation.sortIndex);

const buildBlockedReasonDrafts = (operations: Operation[]) =>
  operations.reduce<Record<string, string>>((drafts, operation) => {
    drafts[operation.id] = operation.blockedReason ?? '';
    return drafts;
  }, {});

const buildTitleDrafts = (operations: Operation[]) =>
  operations.reduce<Record<string, string>>((drafts, operation) => {
    drafts[operation.id] = operation.title;
    return drafts;
  }, {});

const buildCodeDrafts = (operations: Operation[]) =>
  operations.reduce<Record<string, string>>((drafts, operation) => {
    drafts[operation.id] = operation.code;
    return drafts;
  }, {});

const buildEndDateDrafts = (operations: Operation[]) =>
  operations.reduce<Record<string, string>>((drafts, operation) => {
    drafts[operation.id] = operation.endDate?.slice(0, 10) ?? '';
    return drafts;
  }, {});

const buildSortIndexDrafts = (operations: Operation[]) =>
  operations.reduce<Record<string, string>>((drafts, operation) => {
    drafts[operation.id] = String(operation.sortIndex);
    return drafts;
  }, {});

const buildScheduleDateDrafts = (operations: Operation[]) =>
  operations.reduce<Record<string, string>>((drafts, operation) => {
    drafts[operation.id] = operation.startDate?.slice(0, 10) ?? '';
    return drafts;
  }, {});

const formatPrerequisiteSummary = (operation: Operation) => {
  if (!operation.prerequisiteCodes || operation.prerequisiteCodes.length === 0) {
    return null;
  }

  const overflowCount = operation.prerequisiteOverflowCount ?? 0;
  const overflowSuffix = overflowCount > 0 ? ` +${overflowCount} more` : '';

  return `Waiting on ${operation.prerequisiteCodes.join(', ')}${overflowSuffix}`;
};

export default function Home() {
  const [email, setEmail] = useState('owner@tenant-a.local');
  const [password, setPassword] = useState('tenant-a-pass');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loginPending, setLoginPending] = useState(false);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [authMessage, setAuthMessage] = useState('');
  const [boardMessage, setBoardMessage] = useState('');
  const [operationLoadState, setOperationLoadState] = useState<LoadState>('idle');
  const [mutatingOperationId, setMutatingOperationId] = useState<string | null>(null);
  const [scheduleDates, setScheduleDates] = useState<Record<string, string>>({});
  const [endDateDrafts, setEndDateDrafts] = useState<Record<string, string>>({});
  const [blockedReasonDrafts, setBlockedReasonDrafts] = useState<Record<string, string>>({});
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const [codeDrafts, setCodeDrafts] = useState<Record<string, string>>({});
  const [sortIndexDrafts, setSortIndexDrafts] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<BoardFilters>(defaultBoardFilters);
  const hydrationAutoLoadPendingRef = useRef(false);
  const loginPendingRef = useRef(false);
  const manualOperationLoadPendingRef = useRef(false);
  const mutatingOperationIdRef = useRef<string | null>(null);
  const operationLoadSessionRef = useRef(0);

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
  const activeFilters = useMemo(() => getActiveBoardFilters(filters), [filters]);
  const operationBuckets = useMemo(() => buildBuckets(filteredOperations), [filteredOperations]);
  const isFilteredEmptyState =
    operationLoadState === 'loaded' && operations.length > 0 && filteredOperations.length === 0;
  const showActiveFilterSummary = operationLoadState === 'loaded' && activeFilters.length > 0;

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

    const storedAccessToken = window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY);

    if (!storedAccessToken) {
      return;
    }

    hydrationAutoLoadPendingRef.current = true;
    setAccessToken(storedAccessToken);
    setAuthMessage('Logged in');
  }, []);

  useEffect(() => {
    if (!accessToken || !hydrationAutoLoadPendingRef.current) {
      return;
    }

    hydrationAutoLoadPendingRef.current = false;
    resetOperationsState();

    void loadOperations(createTrpcClient(accessToken)).catch(() => {
      // state is already updated in loadOperations
    });
  }, [accessToken]);

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
    mutatingOperationIdRef.current = null;
    setMutatingOperationId(null);
    setScheduleDates({});
    setEndDateDrafts({});
    setBlockedReasonDrafts({});
    setTitleDrafts({});
    setCodeDrafts({});
    setSortIndexDrafts({});
    setOperationLoadState('idle');
  };

  const invalidateOperationLoads = () => {
    operationLoadSessionRef.current += 1;
  };

  const resetSession = (message = 'Logged out') => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY);
    }

    invalidateOperationLoads();
    hydrationAutoLoadPendingRef.current = false;
    setAccessToken(null);
    resetOperationsState();
    setAuthMessage(message);
  };

  const loadOperations = async (client = trpcClient) => {
    const loadSession = operationLoadSessionRef.current;
    setOperationLoadState('loading');

    try {
      const result = await client.operation.list.query();
      if (loadSession !== operationLoadSessionRef.current) {
        return [];
      }

      const loadedOperations = result as Operation[];
      setOperations(loadedOperations);
      setScheduleDates(buildScheduleDateDrafts(loadedOperations));
      setEndDateDrafts(buildEndDateDrafts(loadedOperations));
      setBlockedReasonDrafts(buildBlockedReasonDrafts(loadedOperations));
      setTitleDrafts(buildTitleDrafts(loadedOperations));
      setCodeDrafts(buildCodeDrafts(loadedOperations));
      setSortIndexDrafts(buildSortIndexDrafts(loadedOperations));
      setOperationLoadState(loadedOperations.length > 0 ? 'loaded' : 'empty');
      return loadedOperations;
    } catch (error) {
      if (loadSession !== operationLoadSessionRef.current) {
        return [];
      }

      if (hasForbiddenCode(error)) {
        resetSession(SESSION_EXPIRED_AUTH_MESSAGE);
      } else {
        setOperations([]);
        setOperationLoadState('error');
      }

      throw error;
    }
  };

  const onLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (loginPendingRef.current) {
      return;
    }

    loginPendingRef.current = true;
    setLoginPending(true);
    setAuthMessage('');

    try {
      const result = await trpcClient.auth.login.mutate({ email, password });
      const nextAccessToken = result.accessToken;
      window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, nextAccessToken);
      setAccessToken(nextAccessToken);
      resetOperationsState();
      setAuthMessage('Logged in');

      try {
        await loadOperations(createTrpcClient(nextAccessToken));
      } catch {
        // state is already updated in loadOperations
      }
    } catch {
      resetSession();
      setAuthMessage('Invalid credentials');
    } finally {
      loginPendingRef.current = false;
      setLoginPending(false);
    }
  };

  const onLoadOperations = async () => {
    if (manualOperationLoadPendingRef.current) {
      return;
    }

    manualOperationLoadPendingRef.current = true;

    try {
      await loadOperations();
    } catch {
      // state is already updated in loadOperations
    } finally {
      manualOperationLoadPendingRef.current = false;
    }
  };

  const onUpdateOperation = async (
    operation: Operation,
    updates: OperationUpdate,
    failureMessage: string,
  ) => {
    if (mutatingOperationIdRef.current !== null) {
      return;
    }

    setBoardMessage('');
    mutatingOperationIdRef.current = operation.id;
    setMutatingOperationId(operation.id);

    try {
      const updatedOperation = (await trpcClient.operation.update.mutate({
        id: operation.id,
        tenantId: operation.tenantId,
        version: operation.version,
        ...updates,
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
      setEndDateDrafts((currentEndDateDrafts) => ({
        ...currentEndDateDrafts,
        [updatedOperation.id]: updatedOperation.endDate?.slice(0, 10) ?? '',
      }));
      setBlockedReasonDrafts((currentBlockedReasonDrafts) => ({
        ...currentBlockedReasonDrafts,
        [updatedOperation.id]: updatedOperation.blockedReason ?? '',
      }));
      setTitleDrafts((currentTitleDrafts) => ({
        ...currentTitleDrafts,
        [updatedOperation.id]: updatedOperation.title,
      }));
      setCodeDrafts((currentCodeDrafts) => ({
        ...currentCodeDrafts,
        [updatedOperation.id]: updatedOperation.code,
      }));
      setSortIndexDrafts((currentSortIndexDrafts) => ({
        ...currentSortIndexDrafts,
        [updatedOperation.id]: String(updatedOperation.sortIndex),
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
        setBoardMessage(failureMessage);
      }
    } finally {
      mutatingOperationIdRef.current = null;
      setMutatingOperationId(null);
    }
  };

  const onMoveOperation = async (operation: Operation, bucketLabel: Exclude<BucketFilter, 'ALL'>) => {
    const nextStartDate = toStartDate(bucketLabel);

    if (nextStartDate === operation.startDate) {
      return;
    }

    await onUpdateOperation(operation, { startDate: nextStartDate }, 'Failed to move operation.');
  };

  const onStatusChange = async (operation: Operation, status: Operation['status']) => {
    if (status === operation.status) {
      return;
    }

    await onUpdateOperation(operation, { status }, 'Failed to update operation status.');
  };

  const onScheduleOperation = async (event: FormEvent<HTMLFormElement>, operation: Operation) => {
    event.preventDefault();

    const selectedDate = getScheduledDateValue(operation, scheduleDates);

    if (!isDateBucket(selectedDate)) {
      return;
    }

    await onMoveOperation(operation, selectedDate);
  };

  const onSaveBlockedReason = async (event: FormEvent<HTMLFormElement>, operation: Operation) => {
    event.preventDefault();

    const blockedReason = getBlockedReasonValue(operation, blockedReasonDrafts);

    if (blockedReason === (operation.blockedReason ?? '')) {
      return;
    }

    await onUpdateOperation(operation, { blockedReason }, 'Failed to update blocked reason.');
  };

  const onClearBlockedReason = async (operation: Operation) => {
    if (!operation.blockedReason) {
      return;
    }

    await onUpdateOperation(operation, { blockedReason: null }, 'Failed to update blocked reason.');
  };

  const onSaveTitle = async (event: FormEvent<HTMLFormElement>, operation: Operation) => {
    event.preventDefault();

    const title = getTitleValue(operation, titleDrafts);

    if (title.trim() === '' || title === operation.title) {
      return;
    }

    await onUpdateOperation(operation, { title }, 'Failed to update title.');
  };

  const onSaveCode = async (event: FormEvent<HTMLFormElement>, operation: Operation) => {
    event.preventDefault();

    const code = getCodeValue(operation, codeDrafts);

    if (code.trim() === '' || code === operation.code) {
      return;
    }

    await onUpdateOperation(operation, { code }, 'Failed to update code.');
  };

  const onSaveEndDate = async (event: FormEvent<HTMLFormElement>, operation: Operation) => {
    event.preventDefault();

    const endDate = getEndDateValue(operation, endDateDrafts);

    if (!isDateBucket(endDate) || endDate === operation.endDate?.slice(0, 10)) {
      return;
    }

    await onUpdateOperation(operation, { endDate: `${endDate}T00:00:00.000Z` }, 'Failed to update end date.');
  };

  const onClearEndDate = async (operation: Operation) => {
    if (!operation.endDate) {
      return;
    }

    await onUpdateOperation(operation, { endDate: null }, 'Failed to update end date.');
  };

  const onSaveSortIndex = async (event: FormEvent<HTMLFormElement>, operation: Operation) => {
    event.preventDefault();

    const nextSortIndexValue = getSortIndexValue(operation, sortIndexDrafts).trim();

    if (nextSortIndexValue === '') {
      return;
    }

    const sortIndex = Number(nextSortIndexValue);

    if (!Number.isInteger(sortIndex) || sortIndex === operation.sortIndex) {
      return;
    }

    await onUpdateOperation(operation, { sortIndex }, 'Failed to update sort index.');
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

        <button
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
          type="submit"
          disabled={loginPending}
        >
          {loginPending ? 'Logging in...' : 'Login'}
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
        {accessToken ? (
          <button
            className="rounded border border-slate-400 px-3 py-2 text-slate-900"
            type="button"
            onClick={() => resetSession()}
          >
            Logout and reset session
          </button>
        ) : null}
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
              Code or title
              <input
                className="rounded border bg-white px-2 py-1"
                type="search"
                value={filters.query}
                onChange={(event) =>
                  setFilters((currentFilters) => ({
                    ...currentFilters,
                    query: event.target.value,
                  }))
                }
              />
            </label>

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

            <button
              className="rounded border px-3 py-2 text-sm"
              type="button"
              onClick={() => setFilters(DEFAULT_BOARD_FILTERS)}
            >
              Clear filters
            </button>
          </div>

          {showActiveFilterSummary ? (
            <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">Showing {filteredOperations.length} of {operations.length} operations.</p>
                {activeFilters.map((filter) => (
                  <span
                    key={filter.key}
                    className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white px-2 py-0.5 text-xs font-medium text-amber-900"
                  >
                    <span>
                      {filter.label}: {filter.value}
                    </span>
                    <button
                      className="rounded-full border border-amber-300 px-1 text-[10px] leading-none text-amber-900"
                      type="button"
                      aria-label={`Clear ${filter.label.toLowerCase()} filter`}
                      onClick={() =>
                        setFilters((currentFilters) => clearBoardFilter(currentFilters, filter.key))
                      }
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {isFilteredEmptyState ? (
            <div className="rounded border bg-slate-50 p-4">
              <p className="font-medium">No operations match the current filters.</p>
              <p className="mt-1 text-sm text-slate-600">
                Clear filters to return to the full board without reloading operations.
              </p>
            </div>
          ) : (
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
                      const endDateValue = getEndDateValue(operation, endDateDrafts);
                      const blockedReasonValue = getBlockedReasonValue(operation, blockedReasonDrafts);
                      const titleValue = getTitleValue(operation, titleDrafts);
                      const codeValue = getCodeValue(operation, codeDrafts);
                      const sortIndexValue = getSortIndexValue(operation, sortIndexDrafts);
                      const canSaveTitle = titleValue.trim() !== '' && titleValue !== operation.title;
                      const canSaveCode = codeValue.trim() !== '' && codeValue !== operation.code;
                      const canSchedule =
                        isDateBucket(scheduledDateValue) && scheduledDateValue !== operation.startDate?.slice(0, 10);
                      const canSaveEndDate =
                        isDateBucket(endDateValue) && endDateValue !== operation.endDate?.slice(0, 10);
                      const canClearEndDate = operation.endDate !== undefined;
                      const canClearBlockedReason = operation.blockedReason !== undefined;
                      const canSaveBlockedReason = blockedReasonValue !== (operation.blockedReason ?? '');
                      const parsedSortIndex = Number(sortIndexValue.trim());
                      const canSaveSortIndex =
                        sortIndexValue.trim() !== '' &&
                        Number.isInteger(parsedSortIndex) &&
                        parsedSortIndex !== operation.sortIndex;
                      const prerequisiteSummary = formatPrerequisiteSummary(operation);

                      return (
                        <li key={operation.id} className="rounded border bg-white p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium">
                              {operation.code} — {operation.title}
                            </div>
                            {prerequisiteSummary ? (
                              <p className="mt-1 text-sm text-amber-700">{prerequisiteSummary}</p>
                            ) : null}
                          </div>
                          {operation.dependencyCount > 0 && !prerequisiteSummary ? (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                              Blocked by {operation.dependencyCount}
                            </span>
                          ) : null}
                        </div>
                        <form
                          className="mt-2 flex items-end gap-2"
                          onSubmit={(event) => void onSaveCode(event, operation)}
                        >
                          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                            Code
                            <input
                              className="rounded border bg-white px-2 py-1"
                              value={codeValue}
                              disabled={mutatingOperationId !== null}
                              onChange={(event) =>
                                setCodeDrafts((currentCodeDrafts) => ({
                                  ...currentCodeDrafts,
                                  [operation.id]: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <button
                            className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
                            type="submit"
                            disabled={mutatingOperationId !== null || !canSaveCode}
                          >
                            Save code
                          </button>
                        </form>
                        <form
                          className="mt-3 flex items-end gap-2"
                          onSubmit={(event) => void onSaveTitle(event, operation)}
                        >
                          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                            Title
                            <input
                              className="rounded border bg-white px-2 py-1"
                              value={titleValue}
                              disabled={mutatingOperationId !== null}
                              onChange={(event) =>
                                setTitleDrafts((currentTitleDrafts) => ({
                                  ...currentTitleDrafts,
                                  [operation.id]: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <button
                            className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
                            type="submit"
                            disabled={mutatingOperationId !== null || !canSaveTitle}
                          >
                            Save title
                          </button>
                        </form>
                        <form
                          className="mt-3 flex items-end gap-2"
                          onSubmit={(event) => void onSaveEndDate(event, operation)}
                        >
                          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                            End date
                            <input
                              className="rounded border bg-white px-2 py-1"
                              type="date"
                              value={endDateValue}
                              disabled={mutatingOperationId !== null}
                              onChange={(event) =>
                                setEndDateDrafts((currentEndDateDrafts) => ({
                                  ...currentEndDateDrafts,
                                  [operation.id]: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <button
                            className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
                            type="submit"
                            disabled={mutatingOperationId !== null || !canSaveEndDate}
                          >
                            Save end
                          </button>
                          {canClearEndDate ? (
                            <button
                              className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
                              type="button"
                              disabled={mutatingOperationId !== null}
                              onClick={() => void onClearEndDate(operation)}
                            >
                              Clear end
                            </button>
                          ) : null}
                        </form>
                        <form
                          className="mt-3 flex items-end gap-2"
                          onSubmit={(event) => void onSaveSortIndex(event, operation)}
                        >
                          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                            Sort index
                            <input
                              className="rounded border bg-white px-2 py-1"
                              type="number"
                              inputMode="numeric"
                              value={sortIndexValue}
                              disabled={mutatingOperationId !== null}
                              onChange={(event) =>
                                setSortIndexDrafts((currentSortIndexDrafts) => ({
                                  ...currentSortIndexDrafts,
                                  [operation.id]: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <button
                            className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
                            type="submit"
                            disabled={mutatingOperationId !== null || !canSaveSortIndex}
                          >
                            Save sort
                          </button>
                        </form>
                        {operation.blockedReason ? (
                          <div className="mt-3 flex items-center gap-2 text-sm text-amber-700">
                            <span className="min-w-0 flex-1">Blocked: {operation.blockedReason}</span>
                            {operation.status !== 'BLOCKED' ? (
                              <button
                                className="rounded border px-3 py-1.5 text-sm text-slate-900 disabled:opacity-50"
                                type="button"
                                disabled={mutatingOperationId !== null}
                                onClick={() => void onClearBlockedReason(operation)}
                              >
                                Clear reason
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                          {operation.status === 'BLOCKED' ? (
                            <form
                              className="mt-3 flex items-end gap-2"
                              onSubmit={(event) => void onSaveBlockedReason(event, operation)}
                            >
                              <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                                Blocked reason
                                <input
                                  className="rounded border bg-white px-2 py-1"
                                  value={blockedReasonValue}
                                  disabled={mutatingOperationId !== null}
                                  onChange={(event) =>
                                    setBlockedReasonDrafts((currentBlockedReasonDrafts) => ({
                                      ...currentBlockedReasonDrafts,
                                      [operation.id]: event.target.value,
                                    }))
                                  }
                                />
                              </label>
                              <button
                                className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
                                type="submit"
                                disabled={mutatingOperationId !== null || !canSaveBlockedReason}
                              >
                                Save reason
                              </button>
                              {canClearBlockedReason ? (
                                <button
                                  className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
                                  type="button"
                                  disabled={mutatingOperationId !== null}
                                  onClick={() => void onClearBlockedReason(operation)}
                                >
                                  Clear reason
                                </button>
                              ) : null}
                            </form>
                          ) : null}
                          <label className="mt-3 flex flex-col gap-1 text-sm">
                            Status
                           <select
                             className="max-w-[11rem] rounded border bg-white px-2 py-1"
                             value={operation.status}
                             disabled={mutatingOperationId !== null}
                             onChange={(event) =>
                               void onStatusChange(operation, event.target.value as Operation['status'])
                             }
                           >
                             {BOARD_STATUS_VALUES.map((status) => (
                               <option key={status} value={status}>
                                 {status}
                               </option>
                             ))}
                           </select>
                         </label>
                         <label className="mt-3 flex flex-col gap-1 text-sm">
                           Move to bucket
                           <select
                             className="rounded border bg-white px-2 py-1"
                             value={getOperationBucketLabel(operation.startDate)}
                             disabled={mutatingOperationId !== null}
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
                               disabled={mutatingOperationId !== null}
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
                             disabled={mutatingOperationId !== null || !canSchedule}
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
          )}
        </>
      ) : null}
    </main>
  );
}
