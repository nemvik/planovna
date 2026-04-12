'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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

type LoadState = 'loading' | 'loaded' | 'empty' | 'error';
type HorizonFilter = 'ALL' | 'NEXT_30_DAYS' | 'PAST_DUE';
type KindFilter = 'ALL' | CashflowItem['kind'];

const formatMoney = (amount: number, currency: CashflowItem['currency']) =>
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

export default function CashflowPage() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [cashflowItems, setCashflowItems] = useState<CashflowItem[]>([]);
  const [horizonFilter, setHorizonFilter] = useState<HorizonFilter>('ALL');
  const [kindFilter, setKindFilter] = useState<KindFilter>('ALL');

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

    setLoadState('loading');
    client.cashflow.list
      .query()
      .then((result) => {
        if (cancelled) return;
        setCashflowItems(result as CashflowItem[]);
        setLoadState(result.length === 0 ? 'empty' : 'loaded');
      })
      .catch(() => {
        if (cancelled) return;
        setCashflowItems([]);
        setLoadState('error');
      });

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

  return (
    <main className="mx-auto min-h-screen max-w-6xl p-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-sky-700">Finance module</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">Cashflow</h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-600">
              Review the finance timeline after invoice work is done, with upcoming and completed cashflow items in one focused workspace.
            </p>
            <p className="mt-2 text-sm text-slate-500">Cashflow is the final finance step after invoice review. Use invoices when you need the source finance document behind a linked cashflow item.</p>
          </div>
          <Link className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900" href="/invoices">
            Open invoices
          </Link>
        </div>
      </header>

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
    </main>
  );
}
