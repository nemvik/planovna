"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createTrpcClient } from '../../lib/trpc/client';
import Home from '../page';

const HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY = 'planovna.homepage.accessToken';

type InvoiceSummary = {
  id: string;
  number: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID';
  amountGross: number;
  currency: 'CZK' | 'EUR';
  dueAt?: string;
  pdfPath: string;
};

const formatMoney = (amount: number, currency: InvoiceSummary['currency']) =>
  new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const accessToken = window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY);
    setHasToken(Boolean(accessToken));

    if (!accessToken) {
      setInvoices([]);
      return;
    }

    const client = createTrpcClient(accessToken);
    void client.invoice.list
      .query()
      .then((result) => setInvoices((result as InvoiceSummary[]).slice(0, 5)))
      .catch(() => setInvoices([]));
  }, []);

  const content = useMemo(
    () => (
      <div className="space-y-4">
        <header className="space-y-1">
          <p className="text-sm font-medium text-slate-500">Finance</p>
          <h1 className="text-2xl font-semibold">Invoices</h1>
          <p className="text-sm text-slate-600">
            Dedicated invoice view built on the same shipped homepage finance and export contract.
          </p>
        </header>
        <section aria-label="Invoice export actions" className="rounded border bg-slate-50 p-4">
          <h2 className="text-lg font-medium">Invoice export actions</h2>
          <p className="mt-1 text-sm text-slate-600">
            Use the shipped PDF export baseline path pattern when working with a concrete invoice ID.
          </p>
          <code className="mt-3 block rounded bg-white px-3 py-2 text-sm text-slate-800">
            /invoices/&lt;invoiceId&gt;/pdf
          </code>
          <div className="mt-3">
            <Link className="text-sm font-medium text-sky-700 underline" href="/">
              Open homepage finance workspace
            </Link>
          </div>
        </section>
        <section aria-label="Invoice list" className="rounded border bg-slate-50 p-4">
          <h2 className="text-lg font-medium">Recent invoices</h2>
          {!hasToken ? (
            <p className="mt-1 text-sm text-slate-600">Log in on the homepage to load invoice data.</p>
          ) : invoices.length === 0 ? (
            <p className="mt-1 text-sm text-slate-600">No invoices available yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {invoices.map((invoice) => (
                <li key={invoice.id} className="rounded border bg-white px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{invoice.number}</span>
                    <span>{invoice.status}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3 text-slate-600">
                    <span>{formatMoney(invoice.amountGross, invoice.currency)}</span>
                    <span>{invoice.dueAt ? invoice.dueAt.slice(0, 10) : 'No due date'}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <Home />
      </div>
    ),
    [hasToken, invoices],
  );

  return content;
}
