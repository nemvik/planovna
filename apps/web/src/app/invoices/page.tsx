'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import HomeWorkspace, { HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY } from '../home-workspace';
import { createTrpcClient } from '../../lib/trpc/client';

type InvoiceSummary = {
  id: string;
  number: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID';
  amountGross: number;
  currency: 'CZK' | 'EUR';
  buyerDisplayName?: string;
  dueAt?: string;
  paidAt?: string;
  pdfPath: string;
};

type LoadState = 'loading' | 'loaded' | 'empty' | 'error';
type StatusFilter = 'ALL' | 'NEEDS_ATTENTION' | 'PAID' | 'DRAFT';

const formatMoney = (amount: number, currency: InvoiceSummary['currency']) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount / 100);

const formatDate = (value?: string) => {
  if (!value) {
    return 'No due date';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'No due date';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const getCustomerLabel = (invoice: InvoiceSummary) => {
  if (invoice.buyerDisplayName && invoice.buyerDisplayName.trim().length > 0) {
    return invoice.buyerDisplayName;
  }

  return 'Customer name is not available.';
};

const getUrgency = (invoice: InvoiceSummary, now: Date) => {
  if (invoice.status === 'PAID') {
    return {
      tone: 'emerald' as const,
      label: invoice.paidAt ? `Paid ${formatDate(invoice.paidAt)}` : 'Paid',
      badge: 'Paid',
      needsAttention: false,
    };
  }

  if (invoice.status === 'DRAFT') {
    return {
      tone: 'slate' as const,
      label: 'Draft invoice',
      badge: 'Draft',
      needsAttention: false,
    };
  }

  if (!invoice.dueAt) {
    return {
      tone: 'amber' as const,
      label: 'Due date is not available',
      badge: 'Unpaid',
      needsAttention: true,
    };
  }

  const dueDate = new Date(invoice.dueAt);
  if (Number.isNaN(dueDate.getTime())) {
    return {
      tone: 'amber' as const,
      label: 'Due date is not available',
      badge: 'Unpaid',
      needsAttention: true,
    };
  }

  const nowAtMidnight = new Date(now);
  nowAtMidnight.setHours(0, 0, 0, 0);
  const dueAtMidnight = new Date(dueDate);
  dueAtMidnight.setHours(0, 0, 0, 0);
  const daysUntilDue = Math.round((dueAtMidnight.getTime() - nowAtMidnight.getTime()) / 86400000);

  if (daysUntilDue < 0) {
    return {
      tone: 'rose' as const,
      label: `${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? '' : 's'} overdue`,
      badge: 'Overdue',
      needsAttention: true,
    };
  }

  if (daysUntilDue === 0) {
    return {
      tone: 'amber' as const,
      label: 'Due today',
      badge: 'Due today',
      needsAttention: true,
    };
  }

  return {
    tone: 'sky' as const,
    label: `Due ${formatDate(invoice.dueAt)}`,
    badge: 'Issued',
    needsAttention: false,
  };
};

const toneClasses = {
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
  sky: 'border-sky-200 bg-sky-50 text-sky-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
} as const;

export default function InvoicesPage() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

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
    client.invoice.list
      .query()
      .then((nextInvoices) => {
        if (cancelled) {
          return;
        }

        setInvoices(nextInvoices as InvoiceSummary[]);
        setLoadState(nextInvoices.length === 0 ? 'empty' : 'loaded');
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setInvoices([]);
        setLoadState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [hasSession]);

  const now = new Date(Date.now());

  const metrics = useMemo(() => {
    const all = invoices.length;
    const drafts = invoices.filter((invoice) => invoice.status === 'DRAFT').length;
    const paid = invoices.filter((invoice) => invoice.status === 'PAID').length;
    const overdue = invoices.filter((invoice) => getUrgency(invoice, now).badge === 'Overdue').length;
    const unpaid = invoices.filter((invoice) => invoice.status !== 'PAID').length;

    return [
      { label: 'All invoices', value: all },
      { label: 'Unpaid', value: unpaid },
      { label: 'Overdue', value: overdue },
      { label: 'Paid', value: paid },
      { label: 'Drafts', value: drafts },
    ];
  }, [invoices, now]);

  const filteredInvoices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const urgency = getUrgency(invoice, now);
      const matchesSearch =
        query.length === 0 ||
        invoice.number.toLowerCase().includes(query) ||
        getCustomerLabel(invoice).toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'PAID' && invoice.status === 'PAID') ||
        (statusFilter === 'DRAFT' && invoice.status === 'DRAFT') ||
        (statusFilter === 'NEEDS_ATTENTION' && urgency.needsAttention);

      return matchesSearch && matchesStatus;
    });
  }, [invoices, now, searchQuery, statusFilter]);

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
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">Invoices</h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-600">
              Track invoice status, urgency, and customer-facing totals from one focused workspace.
            </p>
          </div>
          <Link
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            href="/board"
          >
            New invoice
          </Link>
        </div>
      </header>

      <section aria-label="Invoice summary" className="mt-6 grid gap-4 md:grid-cols-5">
        {metrics.map((metric) => (
          <article key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{metric.value}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px] md:flex-1">
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Search invoices
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder="Search by invoice number or customer"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Filter
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              >
                <option value="ALL">All statuses</option>
                <option value="NEEDS_ATTENTION">Needs attention</option>
                <option value="PAID">Paid</option>
                <option value="DRAFT">Drafts</option>
              </select>
            </label>
          </div>
          <p className="text-sm text-slate-500">
            {filteredInvoices.length} of {invoices.length} invoices shown
          </p>
        </div>
      </section>

      <section className="mt-6 space-y-3" aria-label="Invoice list">
        {loadState === 'loading' ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
            Loading invoices…
          </div>
        ) : null}

        {loadState === 'error' ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700 shadow-sm">
            Invoices could not be loaded right now.
          </div>
        ) : null}

        {loadState === 'empty' ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600 shadow-sm">
            No invoices are available yet.
          </div>
        ) : null}

        {loadState === 'loaded' && filteredInvoices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600 shadow-sm">
            No invoices match the current filters.
          </div>
        ) : null}

        {loadState === 'loaded'
          ? filteredInvoices.map((invoice) => {
              const urgency = getUrgency(invoice, now);
              return (
                <article key={invoice.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-slate-950">{invoice.number}</h2>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses[urgency.tone]}`}
                        >
                          {urgency.badge}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                          {invoice.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-slate-700">{getCustomerLabel(invoice)}</p>
                      <p className="mt-1 text-sm text-slate-500">{urgency.label}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Total gross</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">
                        {formatMoney(invoice.amountGross, invoice.currency)}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">Due {formatDate(invoice.dueAt)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Link className="text-sm font-medium text-sky-700 underline" href={invoice.pdfPath}>
                      Open detail
                    </Link>
                    <span className="text-sm text-slate-500">PDF export</span>
                  </div>
                </article>
              );
            })
          : null}
      </section>
    </main>
  );
}
