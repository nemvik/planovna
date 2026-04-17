'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import AppShell from '../app-shell';
import HomeWorkspace, { HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY } from '../home-workspace';
import { createTrpcClient } from '../../lib/trpc/client';

type CashflowItem = {
  id: string;
  tenantId: string;
  invoiceId: string;
  kind: 'PLANNED_IN' | 'ACTUAL_IN';
  amount: number;
  currency: 'CZK' | 'EUR';
  date: string;
};

type RecurringRule = {
  id: string;
  tenantId: string;
  label: string;
  amount: number;
  currency: 'CZK' | 'EUR';
  interval: 'MONTHLY';
  startDate: string;
  nextRunAt: string;
  note?: string;
  status: 'ACTIVE' | 'PAUSED' | 'STOPPED';
  stoppedAt?: string;
  version: number;
};

type RuleForm = {
  label: string;
  amount: string;
  currency: 'CZK' | 'EUR';
  startDate: string;
  note: string;
};

type LoadState = 'loading' | 'loaded' | 'empty' | 'error';
type RulesLoadState = 'loading' | 'loaded' | 'empty' | 'error';
type HorizonFilter = 'ALL' | 'NEXT_30_DAYS' | 'PAST_DUE';
type KindFilter = 'ALL' | CashflowItem['kind'];
type MutationState = 'idle' | 'submitting' | 'error';

const emptyRuleForm: RuleForm = {
  label: '',
  amount: '',
  currency: 'CZK',
  startDate: '',
  note: '',
};

const formatMoney = (amount: number, currency: 'CZK' | 'EUR') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount / 100);

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
};

const getHorizonLabel = (item: CashflowItem, now: Date) => {
  const itemDate = new Date(item.date);
  if (Number.isNaN(itemDate.getTime())) {
    return 'Date unavailable';
  }

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const horizonDate = new Date(startOfToday);
  horizonDate.setDate(horizonDate.getDate() + 30);

  if (itemDate.getTime() < startOfToday.getTime()) {
    return 'Past date';
  }

  if (itemDate.getTime() <= horizonDate.getTime()) {
    return 'Next 30 days';
  }

  return 'Later';
};

const kindTone = {
  PLANNED_IN: 'border-sky-200 bg-sky-50 text-sky-700',
  ACTUAL_IN: 'border-emerald-200 bg-emerald-50 text-emerald-700',
} as const;

const statusTone = {
  ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  PAUSED: 'border-amber-200 bg-amber-50 text-amber-700',
  STOPPED: 'border-slate-200 bg-slate-50 text-slate-700',
} as const;

const toIsoDateTime = (value: string) => {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
};

const getRecurringRuleErrorMessage = (error: unknown, fallback: string) => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'data' in error &&
    typeof error.data === 'object' &&
    error.data !== null &&
    'code' in error.data &&
    error.data.code === 'CONFLICT'
  ) {
    return 'Recurring rule was out of date. Refresh and try again.';
  }

  return fallback;
};

export default function CashflowPage() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [rulesLoadState, setRulesLoadState] = useState<RulesLoadState>('loading');
  const [cashflowItems, setCashflowItems] = useState<CashflowItem[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [horizonFilter, setHorizonFilter] = useState<HorizonFilter>('ALL');
  const [kindFilter, setKindFilter] = useState<KindFilter>('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<RuleForm>(emptyRuleForm);
  const [editForm, setEditForm] = useState<RuleForm>(emptyRuleForm);
  const [createState, setCreateState] = useState<MutationState>('idle');
  const [ruleActionState, setRuleActionState] = useState<Record<string, MutationState>>({});
  const [rulesError, setRulesError] = useState<string | null>(null);

  useEffect(() => {
    const syncSession = () => {
      const token = window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY);
      setHasSession(typeof token === 'string' && token.length > 0);
    };

    syncSession();
    window.addEventListener('storage', syncSession);
    return () => window.removeEventListener('storage', syncSession);
  }, []);

  useEffect(() => {
    if (!hasSession) {
      return;
    }

    const accessToken = window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY) ?? undefined;
    const client = createTrpcClient(accessToken);
    let cancelled = false;

    const loadData = async () => {
      setLoadState('loading');
      setRulesLoadState('loading');

      try {
        const [itemsResult, rulesResult] = await Promise.all([
          client.cashflow.list.query(),
          client.cashflow.listRecurringRules.query(),
        ]);

        if (cancelled) {
          return;
        }

        const nextItems = itemsResult as CashflowItem[];
        const nextRules = rulesResult as RecurringRule[];
        setCashflowItems(nextItems);
        setRecurringRules(nextRules);
        setLoadState(nextItems.length === 0 ? 'empty' : 'loaded');
        setRulesLoadState(nextRules.length === 0 ? 'empty' : 'loaded');
      } catch {
        if (cancelled) {
          return;
        }

        setCashflowItems([]);
        setRecurringRules([]);
        setLoadState('error');
        setRulesLoadState('error');
      }
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [hasSession]);

  const now = new Date(Date.now());

  const summaryCards = useMemo(() => {
    const totalItems = cashflowItems.length;
    const plannedItems = cashflowItems.filter((item) => item.kind === 'PLANNED_IN').length;
    const actualItems = cashflowItems.filter((item) => item.kind === 'ACTUAL_IN').length;
    const next30Days = cashflowItems.filter((item) => getHorizonLabel(item, now) === 'Next 30 days').length;

    return [
      { label: 'All items', value: totalItems },
      { label: 'Planned in', value: plannedItems },
      { label: 'Actual in', value: actualItems },
      { label: 'Next 30 days', value: next30Days },
    ];
  }, [cashflowItems, now]);

  const filteredItems = useMemo(() => {
    return cashflowItems.filter((item) => {
      const matchesKind = kindFilter === 'ALL' || item.kind === kindFilter;
      const horizon = getHorizonLabel(item, now);
      const matchesHorizon =
        horizonFilter === 'ALL' ||
        (horizonFilter === 'NEXT_30_DAYS' && horizon === 'Next 30 days') ||
        (horizonFilter === 'PAST_DUE' && horizon === 'Past date');

      return matchesKind && matchesHorizon;
    });
  }, [cashflowItems, kindFilter, horizonFilter, now]);

  if (hasSession === null) {
    return <main className="mx-auto min-h-screen max-w-6xl p-6 text-slate-600">Loading…</main>;
  }

  if (!hasSession) {
    return <HomeWorkspace />;
  }

  const setActionState = (ruleId: string, state: MutationState) => {
    setRuleActionState((current) => ({ ...current, [ruleId]: state }));
  };

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRulesError(null);

    const amount = Number(createForm.amount);
    const startDate = toIsoDateTime(createForm.startDate);
    if (!createForm.label.trim() || !Number.isFinite(amount) || amount <= 0 || !startDate) {
      setCreateState('error');
      setRulesError('Fill in label, positive amount, and start date.');
      return;
    }

    setCreateState('submitting');

    try {
      const accessToken = window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY) ?? undefined;
      const client = createTrpcClient(accessToken);
      const created = await client.cashflow.createRecurringRule.mutate({
        label: createForm.label.trim(),
        amount,
        currency: createForm.currency,
        interval: 'MONTHLY',
        startDate,
        note: createForm.note.trim() || undefined,
      }) as RecurringRule;

      setRecurringRules((current) => [...current, created]);
      setRulesLoadState('loaded');
      setCreateForm(emptyRuleForm);
      setIsCreateOpen(false);
      setCreateState('idle');
    } catch (error) {
      setCreateState('error');
      setRulesError(getRecurringRuleErrorMessage(error, 'Recurring cashflow item could not be created right now.'));
    }
  };

  const startEditingRule = (rule: RecurringRule) => {
    setEditingRuleId(rule.id);
    setEditForm({
      label: rule.label,
      amount: String(rule.amount),
      currency: rule.currency,
      startDate: rule.startDate.slice(0, 10),
      note: rule.note ?? '',
    });
    setRulesError(null);
  };

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>, rule: RecurringRule) => {
    event.preventDefault();
    setRulesError(null);

    const amount = Number(editForm.amount);
    const startDate = toIsoDateTime(editForm.startDate);
    if (!editForm.label.trim() || !Number.isFinite(amount) || amount <= 0 || !startDate) {
      setActionState(rule.id, 'error');
      setRulesError('Fill in label, positive amount, and start date.');
      return;
    }

    setActionState(rule.id, 'submitting');

    try {
      const accessToken = window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY) ?? undefined;
      const client = createTrpcClient(accessToken);
      const updated = await client.cashflow.updateRecurringRule.mutate({
        id: rule.id,
        version: rule.version,
        label: editForm.label.trim(),
        amount,
        currency: editForm.currency,
        startDate,
        note: editForm.note.trim() || undefined,
      }) as RecurringRule;

      setRecurringRules((current) => current.map((candidate) => (candidate.id === updated.id ? updated : candidate)));
      setEditingRuleId(null);
      setActionState(rule.id, 'idle');
    } catch (error) {
      setActionState(rule.id, 'error');
      setRulesError(getRecurringRuleErrorMessage(error, 'Recurring cashflow item could not be updated right now.'));
    }
  };

  const handleRuleAction = async (rule: RecurringRule, action: 'pause' | 'resume' | 'stop') => {
    setRulesError(null);
    setActionState(rule.id, 'submitting');

    try {
      const accessToken = window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY) ?? undefined;
      const client = createTrpcClient(accessToken);
      const mutate =
        action === 'pause'
          ? client.cashflow.pauseRecurringRule.mutate
          : action === 'resume'
            ? client.cashflow.resumeRecurringRule.mutate
            : client.cashflow.stopRecurringRule.mutate;

      const updated = await mutate({ id: rule.id, version: rule.version }) as RecurringRule;
      setRecurringRules((current) => current.map((candidate) => (candidate.id === updated.id ? updated : candidate)));
      if (editingRuleId === rule.id) {
        setEditingRuleId(null);
      }
      setActionState(rule.id, 'idle');
    } catch (error) {
      setActionState(rule.id, 'error');
      setRulesError(getRecurringRuleErrorMessage(error, 'Recurring cashflow action could not be saved right now.'));
    }
  };

  return (
    <AppShell
      eyebrow="Finance module"
      title="Cashflow"
      description="Review the finance timeline after invoice work is done, with recurring-rule operations and current cashflow items in one focused workspace."
      note="Cashflow stays list-first for current items. Local operations here currently apply to recurring cashflow rules only."
      actions={
        <>
          <button
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white"
            type="button"
            onClick={() => {
              setIsCreateOpen((current) => !current);
              setCreateState('idle');
              setRulesError(null);
            }}
          >
            {isCreateOpen ? 'Close add cashflow item' : 'Add cashflow item'}
          </button>
          <Link className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900" href="/invoices">
            Open invoices
          </Link>
        </>
      }
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Recurring cashflow rules">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Recurring cashflow rules</h2>
            <p className="mt-1 text-sm text-slate-600">Use the local add/edit/actions flow here for recurring items. Invoice-linked cashflow rows below remain review-only.</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
            Recurring rules only
          </span>
        </div>

        {rulesError && !isCreateOpen ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {rulesError}
          </div>
        ) : null}

        {isCreateOpen ? (
          <form className="mt-4 grid gap-4 md:grid-cols-2" aria-label="Add cashflow item form" onSubmit={handleCreateSubmit}>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Label
              <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" value={createForm.label} onChange={(event) => setCreateForm((current) => ({ ...current, label: event.target.value }))} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Amount
              <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" inputMode="decimal" value={createForm.amount} onChange={(event) => setCreateForm((current) => ({ ...current, amount: event.target.value }))} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Currency
              <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" value={createForm.currency} onChange={(event) => setCreateForm((current) => ({ ...current, currency: event.target.value as 'CZK' | 'EUR' }))}>
                <option value="CZK">CZK</option>
                <option value="EUR">EUR</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Start date
              <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" type="date" value={createForm.startDate} onChange={(event) => setCreateForm((current) => ({ ...current, startDate: event.target.value }))} />
            </label>
            <label className="md:col-span-2 flex flex-col gap-1 text-sm text-slate-700">
              Note
              <textarea className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" rows={3} value={createForm.note} onChange={(event) => setCreateForm((current) => ({ ...current, note: event.target.value }))} />
            </label>
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={createState === 'submitting'} type="submit">
                {createState === 'submitting' ? 'Adding item…' : 'Add recurring item'}
              </button>
              <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900" type="button" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </button>
              {rulesError ? <p className="text-sm text-rose-700">{rulesError}</p> : null}
            </div>
          </form>
        ) : null}

        <div className="mt-4 space-y-3">
          {rulesLoadState === 'loading' ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Loading recurring rules…</div> : null}
          {rulesLoadState === 'error' ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Recurring rules could not be loaded right now.</div> : null}
          {rulesLoadState === 'empty' ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">No recurring rules are available yet.</div> : null}
          {rulesLoadState === 'loaded'
            ? recurringRules.map((rule) => {
                const isEditing = editingRuleId === rule.id;
                const actionState = ruleActionState[rule.id] ?? 'idle';

                return (
                  <article key={rule.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    {isEditing ? (
                      <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => void handleEditSubmit(event, rule)}>
                        <label className="flex flex-col gap-1 text-sm text-slate-700">
                          Label
                          <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" value={editForm.label} onChange={(event) => setEditForm((current) => ({ ...current, label: event.target.value }))} />
                        </label>
                        <label className="flex flex-col gap-1 text-sm text-slate-700">
                          Amount
                          <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" inputMode="decimal" value={editForm.amount} onChange={(event) => setEditForm((current) => ({ ...current, amount: event.target.value }))} />
                        </label>
                        <label className="flex flex-col gap-1 text-sm text-slate-700">
                          Currency
                          <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" value={editForm.currency} onChange={(event) => setEditForm((current) => ({ ...current, currency: event.target.value as 'CZK' | 'EUR' }))}>
                            <option value="CZK">CZK</option>
                            <option value="EUR">EUR</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-sm text-slate-700">
                          Start date
                          <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" type="date" value={editForm.startDate} onChange={(event) => setEditForm((current) => ({ ...current, startDate: event.target.value }))} />
                        </label>
                        <label className="md:col-span-2 flex flex-col gap-1 text-sm text-slate-700">
                          Note
                          <textarea className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" rows={3} value={editForm.note} onChange={(event) => setEditForm((current) => ({ ...current, note: event.target.value }))} />
                        </label>
                        <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                          <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={actionState === 'submitting'} type="submit">
                            {actionState === 'submitting' ? 'Saving…' : 'Save changes'}
                          </button>
                          <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900" type="button" onClick={() => setEditingRuleId(null)}>
                            Cancel edit
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-semibold text-slate-950">{rule.label}</h3>
                              <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone[rule.status]}`}>{rule.status}</span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">Monthly</span>
                            </div>
                            <p className="mt-2 text-sm text-slate-600">Starts {formatDate(rule.startDate)}, next run {formatDate(rule.nextRunAt)}</p>
                            {rule.note ? <p className="mt-1 text-sm text-slate-500">{rule.note}</p> : null}
                          </div>
                          <div className="text-right">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Amount</p>
                            <p className="mt-2 text-2xl font-semibold text-slate-950">{formatMoney(rule.amount, rule.currency)}</p>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900" type="button" onClick={() => startEditingRule(rule)}>
                            Edit recurring item
                          </button>
                          {rule.status === 'ACTIVE' ? (
                            <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 disabled:opacity-60" disabled={actionState === 'submitting'} type="button" onClick={() => void handleRuleAction(rule, 'pause')}>
                              Pause
                            </button>
                          ) : null}
                          {rule.status === 'PAUSED' ? (
                            <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 disabled:opacity-60" disabled={actionState === 'submitting'} type="button" onClick={() => void handleRuleAction(rule, 'resume')}>
                              Resume
                            </button>
                          ) : null}
                          {rule.status !== 'STOPPED' ? (
                            <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 disabled:opacity-60" disabled={actionState === 'submitting'} type="button" onClick={() => void handleRuleAction(rule, 'stop')}>
                              Stop
                            </button>
                          ) : null}
                        </div>
                      </>
                    )}
                  </article>
                );
              })
            : null}
        </div>
      </section>

      <section aria-label="Cashflow summary" className="mt-6 grid gap-4 md:grid-cols-4">
        {summaryCards.map((card) => (
          <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="grid gap-3 md:grid-cols-2 md:flex-1">
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Time horizon
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                value={horizonFilter}
                onChange={(event) => setHorizonFilter(event.target.value as HorizonFilter)}
              >
                <option value="ALL">All dates</option>
                <option value="NEXT_30_DAYS">Next 30 days</option>
                <option value="PAST_DUE">Past dates</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Kind
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                value={kindFilter}
                onChange={(event) => setKindFilter(event.target.value as KindFilter)}
              >
                <option value="ALL">All kinds</option>
                <option value="PLANNED_IN">Planned in</option>
                <option value="ACTUAL_IN">Actual in</option>
              </select>
            </label>
          </div>
          <p className="text-sm text-slate-500">{filteredItems.length} of {cashflowItems.length} items shown</p>
        </div>
      </section>

      <section aria-label="Cashflow list" className="mt-6 space-y-3">
        {loadState === 'loading' ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
            Loading cashflow items…
          </div>
        ) : null}

        {loadState === 'error' ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700 shadow-sm">
            Cashflow could not be loaded right now.
          </div>
        ) : null}

        {loadState === 'empty' ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600 shadow-sm">
            No cashflow items are available yet.
          </div>
        ) : null}

        {loadState === 'loaded' && filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600 shadow-sm">
            No cashflow items match the current filters.
          </div>
        ) : null}

        {loadState === 'loaded'
          ? filteredItems.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${kindTone[item.kind]}`}>
                        {item.kind === 'PLANNED_IN' ? 'Planned in' : 'Actual in'}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {getHorizonLabel(item, now)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                        Invoice-linked
                      </span>
                      <p className="text-sm font-medium text-slate-700">Invoice reference: {item.invoiceId}</p>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">Date {formatDate(item.date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Amount</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{formatMoney(item.amount, item.currency)}</p>
                  </div>
                </div>
              </article>
            ))
          : null}
      </section>
    </AppShell>
  );
}
