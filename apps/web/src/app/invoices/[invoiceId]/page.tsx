'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AppShell from '../../app-shell';
import HomeWorkspace, { HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY } from '../../home-workspace';
import { createTrpcClient } from '../../../lib/trpc/client';
import { formatDate, formatMoney, getCustomerLabel, getUrgency, InvoiceSummary } from '../invoice-detail-shared';

const toneClasses = {
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
  sky: 'border-sky-200 bg-sky-50 text-sky-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
} as const;

type Props = {
  params: {
    invoiceId: string;
  };
};

type LoadState = 'loading' | 'loaded' | 'error';

export default function InvoiceDetailPage({ params }: Props) {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [invoice, setInvoice] = useState<InvoiceSummary | null>(null);

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

    const loadInvoice = async () => {
      setLoadState('loading');

      try {
        const nextInvoice = (await client.invoice.getById.query({ invoiceId: params.invoiceId })) as InvoiceSummary;
        if (cancelled) {
          return;
        }

        setInvoice(nextInvoice);
        setLoadState('loaded');
      } catch {
        if (cancelled) {
          return;
        }

        setInvoice(null);
        setLoadState('error');
      }
    };

    void loadInvoice();

    return () => {
      cancelled = true;
    };
  }, [hasSession, params.invoiceId]);

  if (hasSession === null) {
    return <main className="mx-auto min-h-screen max-w-6xl p-6 text-slate-600">Loading…</main>;
  }

  if (!hasSession) {
    return <HomeWorkspace />;
  }

  const actions = (
    <>
      <Link className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900" href="/invoices">
        Back to invoices
      </Link>
      {invoice ? (
        <Link className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white" href={invoice.pdfPath}>
          Open PDF
        </Link>
      ) : null}
    </>
  );

  if (loadState === 'loading') {
    return (
      <AppShell
        eyebrow="Finance module"
        title="Invoice detail"
        description="Review the current invoice snapshot here."
        note="This first slice stays read-only and uses the current single-invoice read contract."
        actions={actions}
      >
        <section className="mt-6 rounded-[1.75rem] border border-slate-200/80 bg-white p-8 text-sm text-slate-600 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.18)]">
          Loading invoice…
        </section>
      </AppShell>
    );
  }

  if (!invoice) {
    return (
      <AppShell
        eyebrow="Finance module"
        title="Invoice detail"
        description="This read-only invoice view opens from the invoices module on the current single-invoice read path."
        note="Invoice detail is not available for this invoice right now."
        actions={actions}
      >
        <section className="mt-6 rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.18)]">
          Invoice detail is not available right now.
        </section>
      </AppShell>
    );
  }

  const urgency = getUrgency(invoice, new Date(Date.now()));

  return (
    <AppShell
      eyebrow="Finance module"
      title={invoice.number}
      description="Review the current invoice snapshot here, then return to the list for invoice actions or open the PDF document."
      note="This first slice stays read-only and uses the current single-invoice read contract only."
      actions={actions}
    >
      <section className="mt-6 rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.3)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-950">Invoice overview</h2>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses[urgency.tone]}`}>
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
            <p className="mt-2 text-2xl font-semibold text-slate-950">{formatMoney(invoice.amountGross, invoice.currency)}</p>
            <p className="mt-1 text-sm text-slate-500">Currency {invoice.currency}</p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Invoice timing">
        <article className="rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.24)]">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Issued</p>
          <p className="mt-2 text-base font-semibold text-slate-950">{formatDate(invoice.issuedAt, 'Not available')}</p>
        </article>
        <article className="rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.24)]">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Due</p>
          <p className="mt-2 text-base font-semibold text-slate-950">{formatDate(invoice.dueAt, 'Not available')}</p>
        </article>
        <article className="rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.24)]">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Paid</p>
          <p className="mt-2 text-base font-semibold text-slate-950">{formatDate(invoice.paidAt, 'Not available')}</p>
        </article>
        <article className="rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.24)]">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Version</p>
          <p className="mt-2 text-base font-semibold text-slate-950">{invoice.version}</p>
        </article>
      </section>

      <section className="mt-6 rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.24)]">
        <h2 className="text-lg font-semibold text-slate-950">Current read-only detail</h2>
        <dl className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Invoice number</dt>
            <dd className="mt-1 text-sm text-slate-900">{invoice.number}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Customer</dt>
            <dd className="mt-1 text-sm text-slate-900">{getCustomerLabel(invoice)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</dt>
            <dd className="mt-1 text-sm text-slate-900">{invoice.status}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">PDF destination</dt>
            <dd className="mt-1 text-sm text-slate-900">Invoice PDF document</dd>
          </div>
        </dl>
      </section>
    </AppShell>
  );
}
