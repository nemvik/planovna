'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AppShell from '../app-shell';
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
    <AppShell
      eyebrow="Operations module"
      title="Orders"
      description="Start from orders, clear what matters next, and hand work forward into Board planning with less friction and stronger visibility."
      note="Use Board when you are ready to plan or schedule the next operational step."
      actions={
        <Link className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm" href="/board">
          Open Board
        </Link>
      }
    >
      <section aria-label="Orders summary" className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((card) => (
          <article key={card.label} className="rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.35)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.28)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:flex-1">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
              Search orders
              <input
                className="rounded-xl border border-slate-300 bg-slate-50/70 px-3 py-2.5 text-sm text-slate-900"
                placeholder="Search by code, title, or notes"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
              Status
              <select
                className="rounded-xl border border-slate-300 bg-slate-50/70 px-3 py-2.5 text-sm text-slate-900"
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
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            <span className="font-medium text-slate-900">{filteredOrders.length}</span> of {orders.length} orders shown
          </div>
        </div>
      </section>

      <section className="space-y-4" aria-label="Orders list">
        {loadState === 'loading' ? (
          <div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-8 text-sm text-slate-600 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.28)]">
            Loading orders…
          </div>
        ) : null}

        {loadState === 'error' ? (
          <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700 shadow-[0_18px_48px_-28px_rgba(244,63,94,0.25)]">
            Orders could not be loaded right now.
          </div>
        ) : null}

        {loadState === 'empty' ? (
          <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.18)]">
            <p className="font-medium text-slate-900">No orders are available yet.</p>
            <p className="mt-2">When a new order is ready to be planned, continue on Board.</p>
          </div>
        ) : null}

        {loadState === 'loaded' && filteredOrders.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.18)]">
            No orders match the current filters.
          </div>
        ) : null}

        {loadState === 'loaded'
          ? filteredOrders.map((order) => (
              <article key={order.id} className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.3)]">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-semibold tracking-tight text-slate-950">{order.code}</h2>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getStatusTone(order.status)}`}>
                        {order.status}
                      </span>
                    </div>
                    <p className="mt-3 text-base font-medium text-slate-800">{order.title}</p>
                    {order.notes ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{order.notes}</p> : null}
                  </div>
                  <div className="min-w-[11rem] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Due date</p>
                    <p className="mt-2 text-base font-semibold text-slate-950">{formatDate(order.dueDate)}</p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                  <Link className="inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm" href="/board">
                    Continue planning on Board
                  </Link>
                </div>
              </article>
            ))
          : null}
      </section>
    </AppShell>
  );
}
