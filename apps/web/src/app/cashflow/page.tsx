"use client";

import Link from 'next/link';
import { useMemo } from 'react';
import Home from '../page';

export default function CashflowPage() {
  const content = useMemo(
    () => (
      <div className="space-y-4">
        <header className="space-y-1">
          <p className="text-sm font-medium text-slate-500">Finance</p>
          <h1 className="text-2xl font-semibold">Cashflow</h1>
          <p className="text-sm text-slate-600">
            Dedicated cashflow view built on the same shipped homepage snapshot contract.
          </p>
        </header>
        <section aria-label="Finance navigation" className="rounded border bg-slate-50 p-4">
          <h2 className="text-lg font-medium">Finance navigation</h2>
          <p className="mt-1 text-sm text-slate-600">
            Jump directly to the dedicated invoice workspace without returning to the homepage.
          </p>
          <div className="mt-3">
            <Link className="text-sm font-medium text-sky-700 underline" href="/invoices">
              Open invoices page
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
