"use client";

import Link from 'next/link';
import { useMemo } from 'react';
import Home from '../page';

export default function InvoicesPage() {
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
        <Home />
      </div>
    ),
    [],
  );

  return content;
}
