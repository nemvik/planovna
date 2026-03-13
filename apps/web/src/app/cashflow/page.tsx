"use client";

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
        <Home />
      </div>
    ),
    [],
  );

  return content;
}
