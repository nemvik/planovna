'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import HomeWorkspace, { HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY } from '../home-workspace';
import { createTrpcClient } from '../../lib/trpc/client';

type OrderSummary = {
  id: string;
  tenantId: string;
  customerId: string;
  code: string;
  title: string;
  status: string;
  dueDate?: string;
  notes?: string;
  version: number;
};

type LoadState = 'loading' | 'loaded' | 'empty' | 'error';

const formatDate = (value?: string) => {
  if (!value) {
    return 'No due date';
  }

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

const getStatusTone = (status: string) => {
  switch (status) {
    case 'DONE':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'IN_PROGRESS':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'BLOCKED':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
};

export default function OrdersPage() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

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
    client.order.list
      .query()
      .then((result) => {
        if (cancelled) return;
        setOrders(result as OrderSummary[]);
        setLoadState(result.length === 0 ? 'empty' : 'loaded');
      })
      .catch(() => {
        if (cancelled) return;
        setOrders([]);
        setLoadState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [hasSession]);

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesSearch =
        query.length === 0 ||
        order.code.toLowerCase().includes(query) ||
        order.title.toLowerCase().includes(query) ||
        (order.notes ?? '').toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  const summaryCards = useMemo(() => {
    const total = orders.length;
    const open = orders.filter((order) => order.status !== 'DONE').length;
    const blocked = orders.filter((order) => order.status === 'BLOCKED').length;
    return [
      { label: 'All orders', value: total },
      { label: 'Open', value: open },
      { label: 'Blocked', value: blocked },
    ];
  }, [orders]);

  const availableStatuses = useMemo(
    () => Array.from(new Set(orders.map((order) => order.status))).sort(),
    [orders],
  );

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
            <p className="text-sm font-medium uppercase tracking-wide text-sky-700">Operations module</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">Orders</h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-600">
              Review active orders, scan delivery timing, and continue into the planning flow from one focused list.
            </p>
            <p className="mt-2 text-sm text-slate-500">Order creation and planning continue on Board.</p>
          </div>
          <Link className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900" href="/board">
            Open Board
          </Link>
        </div>
      </header>

      <section aria-label="Orders summary" className="mt-6 grid gap-4 md:grid-cols-3">
        {summaryCards.map((card) => (
          <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px] md:flex-1">
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Search orders
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder="Search by code, title, or notes"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Status
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="ALL">All statuses</option>
                {availableStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-sm text-slate-500">{filteredOrders.length} of {orders.length} orders shown</p>
        </div>
      </section>

      <section className="mt-6 space-y-3" aria-label="Orders list">
        {loadState === 'loading' ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
            Loading orders…
          </div>
        ) : null}

        {loadState === 'error' ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700 shadow-sm">
            Orders could not be loaded right now.
          </div>
        ) : null}

        {loadState === 'empty' ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600 shadow-sm">
            No orders are available yet.
          </div>
        ) : null}

        {loadState === 'loaded' && filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600 shadow-sm">
            No orders match the current filters.
          </div>
        ) : null}

        {loadState === 'loaded'
          ? filteredOrders.map((order) => (
              <article key={order.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-950">{order.code}</h2>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusTone(order.status)}`}>
                        {order.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-700">{order.title}</p>
                    {order.notes ? <p className="mt-1 text-sm text-slate-500">{order.notes}</p> : null}
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Due date</p>
                    <p className="mt-2 text-base font-semibold text-slate-950">{formatDate(order.dueDate)}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link className="text-sm font-medium text-sky-700 underline" href="/board">
                    Continue in planning
                  </Link>
                </div>
              </article>
            ))
          : null}
      </section>
    </main>
  );
}
