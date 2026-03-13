"use client";

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
        <Home />
      </div>
    ),
    [],
  );

  return content;
}
