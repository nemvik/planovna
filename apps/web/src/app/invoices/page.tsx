'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import AppShell from '../app-shell';
import HomeWorkspace, { HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY } from '../home-workspace';
import { createTrpcClient } from '../../lib/trpc/client';

type InvoiceSummary = {
  id: string;
  number: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED';
  amountGross: number;
  currency: 'CZK' | 'EUR';
  buyerDisplayName?: string;
  issuedAt?: string;
  dueAt?: string;
  paidAt?: string;
  pdfPath: string;
  version: number;
};

type CreateInvoiceInput = {
  orderId: string;
  number: string;
  currency: 'CZK' | 'EUR';
  amountNet: number;
  vatRatePercent: number;
  issuedAt?: string;
  dueAt?: string;
};

type LoadState = 'loading' | 'loaded' | 'empty' | 'error';
type StatusFilter = 'ALL' | 'NEEDS_ATTENTION' | 'PAID' | 'DRAFT' | 'CANCELLED';
type CreateState = 'idle' | 'submitting' | 'error';
type MarkPaidState = 'idle' | 'submitting' | 'error';
type UpdateState = 'idle' | 'submitting' | 'error';
type CancelState = 'idle' | 'submitting' | 'error';

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

  if (invoice.status === 'CANCELLED') {
    return {
      tone: 'slate' as const,
      label: 'Cancelled invoice',
      badge: 'Cancelled',
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

const emptyCreateForm = {
  orderId: '',
  number: '',
  currency: 'CZK' as const,
  amountNet: '',
  vatRatePercent: '21',
  issuedAt: '',
  dueAt: '',
};

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

const getMarkPaidErrorMessage = (error: unknown) => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'data' in error &&
    typeof error.data === 'object' &&
    error.data !== null &&
    'code' in error.data &&
    error.data.code === 'CONFLICT'
  ) {
    return 'Invoice was out of date. Refresh and try marking it paid again.';
  }

  return 'Invoice could not be marked paid right now.';
};

const getUpdateInvoiceErrorMessage = (error: unknown) => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'data' in error &&
    typeof error.data === 'object' &&
    error.data !== null &&
    'code' in error.data &&
    error.data.code === 'CONFLICT'
  ) {
    return 'Invoice was out of date. Refresh and try saving it again.';
  }

  return 'Invoice could not be updated right now.';
};

const getCancelInvoiceErrorMessage = (error: unknown) => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'data' in error &&
    typeof error.data === 'object' &&
    error.data !== null &&
    'code' in error.data &&
    error.data.code === 'CONFLICT'
  ) {
    return 'Invoice was out of date. Refresh and try cancelling it again.';
  }

  return 'Invoice could not be cancelled right now.';
};

export default function InvoicesPage() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createState, setCreateState] = useState<CreateState>('idle');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [markPaidStateByInvoiceId, setMarkPaidStateByInvoiceId] = useState<Record<string, MarkPaidState>>({});
  const [markPaidErrorByInvoiceId, setMarkPaidErrorByInvoiceId] = useState<Record<string, string | null>>({});
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [updateStateByInvoiceId, setUpdateStateByInvoiceId] = useState<Record<string, UpdateState>>({});
  const [updateErrorByInvoiceId, setUpdateErrorByInvoiceId] = useState<Record<string, string | null>>({});
  const [cancelStateByInvoiceId, setCancelStateByInvoiceId] = useState<Record<string, CancelState>>({});
  const [cancelErrorByInvoiceId, setCancelErrorByInvoiceId] = useState<Record<string, string | null>>({});
  const [invoiceNumberDrafts, setInvoiceNumberDrafts] = useState<Record<string, string>>({});
  const [invoiceIssuedAtDrafts, setInvoiceIssuedAtDrafts] = useState<Record<string, string>>({});
  const [invoiceDueAtDrafts, setInvoiceDueAtDrafts] = useState<Record<string, string>>({});

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

    const loadInvoices = async () => {
      setLoadState('loading');

      try {
        const nextInvoices = (await client.invoice.list.query()) as InvoiceSummary[];
        if (cancelled) {
          return;
        }

        setInvoices(nextInvoices);
        setLoadState(nextInvoices.length === 0 ? 'empty' : 'loaded');
      } catch {
        if (cancelled) {
          return;
        }

        setInvoices([]);
        setLoadState('error');
      }
    };

    void loadInvoices();

    return () => {
      cancelled = true;
    };
  }, [hasSession]);

  const now = new Date(Date.now());
  const accessToken = hasSession ? window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY) ?? undefined : undefined;

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
      { label: 'Cancelled', value: invoices.filter((invoice) => invoice.status === 'CANCELLED').length },
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
        (statusFilter === 'CANCELLED' && invoice.status === 'CANCELLED') ||
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

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError(null);

    const amountNet = Number(createForm.amountNet);
    const vatRatePercent = Number(createForm.vatRatePercent);

    if (!createForm.orderId.trim() || !createForm.number.trim() || !Number.isFinite(amountNet) || amountNet <= 0) {
      setCreateState('error');
      setCreateError('Fill in order ID, invoice number, and a positive net amount.');
      return;
    }

    if (!Number.isFinite(vatRatePercent) || vatRatePercent < 0 || vatRatePercent > 100) {
      setCreateState('error');
      setCreateError('VAT rate must be between 0 and 100.');
      return;
    }

    setCreateState('submitting');

    try {
      const client = createTrpcClient(accessToken);
      await client.invoice.issue.mutate({
        orderId: createForm.orderId.trim(),
        number: createForm.number.trim(),
        currency: createForm.currency,
        amountNet,
        vatRatePercent,
        issuedAt: toIsoDateTime(createForm.issuedAt),
        dueAt: toIsoDateTime(createForm.dueAt),
      } satisfies CreateInvoiceInput);

      const nextInvoices = (await client.invoice.list.query()) as InvoiceSummary[];
      setInvoices(nextInvoices);
      setLoadState(nextInvoices.length === 0 ? 'empty' : 'loaded');
      setCreateForm(emptyCreateForm);
      setCreateState('idle');
      setIsCreateOpen(false);
    } catch {
      setCreateState('error');
      setCreateError('Invoice could not be created right now.');
    }
  };

  const startEditingInvoice = (invoice: InvoiceSummary) => {
    setEditingInvoiceId(invoice.id);
    setUpdateErrorByInvoiceId((current) => ({ ...current, [invoice.id]: null }));
    setUpdateStateByInvoiceId((current) => ({ ...current, [invoice.id]: 'idle' }));
    setInvoiceNumberDrafts((current) => ({ ...current, [invoice.id]: invoice.number }));
    setInvoiceIssuedAtDrafts((current) => ({ ...current, [invoice.id]: invoice.issuedAt ? invoice.issuedAt.slice(0, 10) : '' }));
    setInvoiceDueAtDrafts((current) => ({ ...current, [invoice.id]: invoice.dueAt ? invoice.dueAt.slice(0, 10) : '' }));
  };

  const handleUpdateInvoice = async (event: FormEvent<HTMLFormElement>, invoice: InvoiceSummary) => {
    event.preventDefault();
    const number = (invoiceNumberDrafts[invoice.id] ?? '').trim();
    const issuedAt = toIsoDateTime(invoiceIssuedAtDrafts[invoice.id] ?? '');
    const dueAt = toIsoDateTime(invoiceDueAtDrafts[invoice.id] ?? '');

    if (!number || !issuedAt || !dueAt) {
      setUpdateStateByInvoiceId((current) => ({ ...current, [invoice.id]: 'error' }));
      setUpdateErrorByInvoiceId((current) => ({
        ...current,
        [invoice.id]: 'Fill in invoice number, issued date, and due date.',
      }));
      return;
    }

    setUpdateStateByInvoiceId((current) => ({ ...current, [invoice.id]: 'submitting' }));
    setUpdateErrorByInvoiceId((current) => ({ ...current, [invoice.id]: null }));

    try {
      const client = createTrpcClient(accessToken);
      const updated = (await client.invoice.update.mutate({
        invoiceId: invoice.id,
        version: invoice.version,
        number,
        issuedAt,
        dueAt,
      })) as InvoiceSummary;

      setInvoices((current) => current.map((candidate) => (candidate.id === updated.id ? updated : candidate)));
      setUpdateStateByInvoiceId((current) => ({ ...current, [invoice.id]: 'idle' }));
      setEditingInvoiceId((current) => (current === invoice.id ? null : current));
    } catch (error) {
      setUpdateStateByInvoiceId((current) => ({ ...current, [invoice.id]: 'error' }));
      setUpdateErrorByInvoiceId((current) => ({
        ...current,
        [invoice.id]: getUpdateInvoiceErrorMessage(error),
      }));
    }
  };

  const handleCancelInvoice = async (invoice: InvoiceSummary) => {
    setCancelStateByInvoiceId((current) => ({ ...current, [invoice.id]: 'submitting' }));
    setCancelErrorByInvoiceId((current) => ({ ...current, [invoice.id]: null }));

    try {
      const client = createTrpcClient(accessToken);
      const updated = (await client.invoice.cancel.mutate({
        invoiceId: invoice.id,
        version: invoice.version,
      })) as InvoiceSummary;

      setInvoices((current) => current.map((candidate) => (candidate.id === updated.id ? updated : candidate)));
      setCancelStateByInvoiceId((current) => ({ ...current, [invoice.id]: 'idle' }));
    } catch (error) {
      setCancelStateByInvoiceId((current) => ({ ...current, [invoice.id]: 'error' }));
      setCancelErrorByInvoiceId((current) => ({
        ...current,
        [invoice.id]: getCancelInvoiceErrorMessage(error),
      }));
    }
  };

  const handleMarkPaid = async (invoice: InvoiceSummary) => {
    setMarkPaidStateByInvoiceId((current) => ({ ...current, [invoice.id]: 'submitting' }));
    setMarkPaidErrorByInvoiceId((current) => ({ ...current, [invoice.id]: null }));

    try {
      const client = createTrpcClient(accessToken);
      const paidAt = new Date(Date.now()).toISOString();
      const updated = (await client.invoice.paid.mutate({
        invoiceId: invoice.id,
        paidAt,
        version: invoice.version,
      })) as InvoiceSummary;

      setInvoices((current) =>
        current.map((candidate) => (candidate.id === updated.id ? updated : candidate)),
      );
      setMarkPaidStateByInvoiceId((current) => ({ ...current, [invoice.id]: 'idle' }));
    } catch (error) {
      setMarkPaidStateByInvoiceId((current) => ({ ...current, [invoice.id]: 'error' }));
      setMarkPaidErrorByInvoiceId((current) => ({
        ...current,
        [invoice.id]: getMarkPaidErrorMessage(error),
      }));
    }
  };

  return (
    <AppShell
      eyebrow="Finance module"
      title="Invoices"
      description="Create and review invoices here, then continue into cashflow when finance follow-up is needed."
      note="Invoices stay list-first here, with cashflow as a separate next step."
      actions={
        <>
          <button
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white"
            type="button"
            onClick={() => {
              setIsCreateOpen((current) => !current);
              setCreateError(null);
              setCreateState('idle');
            }}
          >
            {isCreateOpen ? 'Close new invoice' : 'New invoice'}
          </button>
          <Link
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900"
            href="/cashflow"
          >
            Open cashflow
          </Link>
        </>
      }
    >
      {isCreateOpen ? (
        <section className="mt-6 rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.3)]" aria-label="New invoice form">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">New invoice</h2>
              <p className="mt-1 text-sm text-slate-600">Use the current issue contract to create a new invoice without leaving this module.</p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
              Local create flow
            </span>
          </div>

          <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleCreateSubmit}>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Order ID
              <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" value={createForm.orderId} onChange={(event) => setCreateForm((current) => ({ ...current, orderId: event.target.value }))} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Invoice number
              <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" value={createForm.number} onChange={(event) => setCreateForm((current) => ({ ...current, number: event.target.value }))} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Currency
              <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" value={createForm.currency} onChange={(event) => setCreateForm((current) => ({ ...current, currency: event.target.value as 'CZK' | 'EUR' }))}>
                <option value="CZK">CZK</option>
                <option value="EUR">EUR</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Net amount
              <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" inputMode="decimal" value={createForm.amountNet} onChange={(event) => setCreateForm((current) => ({ ...current, amountNet: event.target.value }))} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              VAT rate %
              <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" inputMode="decimal" value={createForm.vatRatePercent} onChange={(event) => setCreateForm((current) => ({ ...current, vatRatePercent: event.target.value }))} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Issued at
              <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" type="date" value={createForm.issuedAt} onChange={(event) => setCreateForm((current) => ({ ...current, issuedAt: event.target.value }))} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Due at
              <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" type="date" value={createForm.dueAt} onChange={(event) => setCreateForm((current) => ({ ...current, dueAt: event.target.value }))} />
            </label>
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={createState === 'submitting'} type="submit">
                {createState === 'submitting' ? 'Creating invoice…' : 'Create invoice'}
              </button>
              <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900" type="button" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </button>
              {createError ? <p className="text-sm text-rose-700">{createError}</p> : null}
            </div>
          </form>
        </section>
      ) : null}

      <section aria-label="Invoice summary" className="mt-6 grid gap-4 md:grid-cols-5">
        {metrics.map((metric) => (
          <article key={metric.label} className="rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.24)]">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{metric.value}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.24)]">
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
                <option value="CANCELLED">Cancelled</option>
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
          <div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-8 text-sm text-slate-600 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.24)]">
            Loading invoices…
          </div>
        ) : null}

        {loadState === 'error' ? (
          <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700 shadow-[0_18px_48px_-28px_rgba(244,63,94,0.24)]">
            Invoices could not be loaded right now.
          </div>
        ) : null}

        {loadState === 'empty' ? (
          <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.18)]">
            No invoices are available yet.
          </div>
        ) : null}

        {loadState === 'loaded' && filteredInvoices.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.18)]">
            No invoices match the current filters.
          </div>
        ) : null}

        {loadState === 'loaded'
          ? filteredInvoices.map((invoice) => {
              const urgency = getUrgency(invoice, now);
              const markPaidState = markPaidStateByInvoiceId[invoice.id] ?? 'idle';
              const markPaidError = markPaidErrorByInvoiceId[invoice.id];
              const cancelState = cancelStateByInvoiceId[invoice.id] ?? 'idle';
              const cancelError = cancelErrorByInvoiceId[invoice.id];
              const updateState = updateStateByInvoiceId[invoice.id] ?? 'idle';
              const updateError = updateErrorByInvoiceId[invoice.id];
              const isEditing = editingInvoiceId === invoice.id;
              const canMarkPaid = invoice.status !== 'PAID' && invoice.status !== 'CANCELLED';
              const canCancel = invoice.status !== 'PAID' && invoice.status !== 'CANCELLED';
              return (
                <article key={invoice.id} className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.3)]">
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
                      <p className="mt-1 text-sm text-slate-500">Issued {formatDate(invoice.issuedAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Total gross</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">
                        {formatMoney(invoice.amountGross, invoice.currency)}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">Due {formatDate(invoice.dueAt)}</p>
                    </div>
                  </div>
                  {isEditing ? (
                    <form className="mt-4 grid gap-4 md:grid-cols-3" onSubmit={(event) => void handleUpdateInvoice(event, invoice)}>
                      <label className="flex flex-col gap-1 text-sm text-slate-700">
                        Invoice number
                        <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" value={invoiceNumberDrafts[invoice.id] ?? ''} onChange={(event) => setInvoiceNumberDrafts((current) => ({ ...current, [invoice.id]: event.target.value }))} />
                      </label>
                      <label className="flex flex-col gap-1 text-sm text-slate-700">
                        Issued at
                        <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" type="date" value={invoiceIssuedAtDrafts[invoice.id] ?? ''} onChange={(event) => setInvoiceIssuedAtDrafts((current) => ({ ...current, [invoice.id]: event.target.value }))} />
                      </label>
                      <label className="flex flex-col gap-1 text-sm text-slate-700">
                        Due at
                        <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" type="date" value={invoiceDueAtDrafts[invoice.id] ?? ''} onChange={(event) => setInvoiceDueAtDrafts((current) => ({ ...current, [invoice.id]: event.target.value }))} />
                      </label>
                      <div className="md:col-span-3 flex flex-wrap items-center gap-3">
                        <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" type="submit" disabled={updateState === 'submitting'}>
                          {updateState === 'submitting' ? 'Saving invoice…' : 'Save invoice'}
                        </button>
                        <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900" type="button" onClick={() => setEditingInvoiceId((current) => (current === invoice.id ? null : current))}>
                          Cancel edit
                        </button>
                        {updateError ? <span className="text-sm text-rose-700">{updateError}</span> : null}
                      </div>
                    </form>
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {!isEditing ? (
                      <button
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                        type="button"
                        onClick={() => startEditingInvoice(invoice)}
                      >
                        Edit invoice
                      </button>
                    ) : null}
                    {canCancel ? (
                      <>
                        <button
                          className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-700 disabled:opacity-60"
                          type="button"
                          disabled={cancelState === 'submitting'}
                          onClick={() => void handleCancelInvoice(invoice)}
                        >
                          {cancelState === 'submitting' ? 'Cancelling invoice…' : 'Cancel invoice'}
                        </button>
                        {cancelError ? <span className="text-sm text-rose-700">{cancelError}</span> : null}
                      </>
                    ) : null}
                    {canMarkPaid ? (
                      <>
                        <button
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 disabled:opacity-60"
                          type="button"
                          disabled={markPaidState === 'submitting'}
                          onClick={() => void handleMarkPaid(invoice)}
                        >
                          {markPaidState === 'submitting' ? 'Marking paid…' : 'Mark paid'}
                        </button>
                        {markPaidError ? <span className="text-sm text-rose-700">{markPaidError}</span> : null}
                      </>
                    ) : null}
                    <Link className="text-sm font-medium text-sky-700 underline" href={invoice.pdfPath}>
                      Open PDF
                    </Link>
                    <span className="text-sm text-slate-500">Invoice PDF document</span>
                  </div>
                </article>
              );
            })
          : null}
      </section>
    </AppShell>
  );
}
