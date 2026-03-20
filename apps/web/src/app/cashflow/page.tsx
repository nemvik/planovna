"use client";

import Link from 'next/link';
import { useMemo } from 'react';
import Home from '../page';

type CashflowPageLocaleStrings = {
  sectionEyebrow: string;
  pageTitle: string;
  pageIntro: string;
  financeNavigationAriaLabel: string;
  financeNavigationTitle: string;
  financeNavigationHelper: string;
  openInvoicesPageLink: string;
};

const CASHFLOW_PAGE_LOCALES: Record<'cs' | 'en' | 'de', CashflowPageLocaleStrings> = {
  cs: {
    sectionEyebrow: 'Finance',
    pageTitle: 'Peněžní tok',
    pageIntro: 'Dedikovaný přehled peněžního toku postavený na stejném nasazeném kontraktu homepage snapshotu.',
    financeNavigationAriaLabel: 'Navigace financí',
    financeNavigationTitle: 'Navigace financí',
    financeNavigationHelper: 'Přejděte přímo do dedikovaného workspace faktur bez návratu na homepage.',
    openInvoicesPageLink: 'Otevřít stránku faktur',
  },
  en: {
    sectionEyebrow: 'Finance',
    pageTitle: 'Cashflow',
    pageIntro: 'Dedicated cashflow view built on the same shipped homepage snapshot contract.',
    financeNavigationAriaLabel: 'Finance navigation',
    financeNavigationTitle: 'Finance navigation',
    financeNavigationHelper: 'Jump directly to the dedicated invoice workspace without returning to the homepage.',
    openInvoicesPageLink: 'Open invoices page',
  },
  de: {
    sectionEyebrow: 'Finanzen',
    pageTitle: 'Cashflow',
    pageIntro: 'Dedizierte Cashflow-Ansicht auf Basis desselben ausgelieferten Homepage-Snapshot-Vertrags.',
    financeNavigationAriaLabel: 'Finanznavigation',
    financeNavigationTitle: 'Finanznavigation',
    financeNavigationHelper: 'Wechseln Sie direkt zum dedizierten Rechnungs-Workspace, ohne zur Homepage zurückzukehren.',
    openInvoicesPageLink: 'Rechnungsseite öffnen',
  },
};

export default function CashflowPage() {
  const cashflowCopy = CASHFLOW_PAGE_LOCALES.en;

  const content = useMemo(
    () => (
      <div className="space-y-4">
        <header className="space-y-1">
          <p className="text-sm font-medium text-slate-500">{cashflowCopy.sectionEyebrow}</p>
          <h1 className="text-2xl font-semibold">{cashflowCopy.pageTitle}</h1>
          <p className="text-sm text-slate-600">{cashflowCopy.pageIntro}</p>
        </header>
        <section aria-label={cashflowCopy.financeNavigationAriaLabel} className="rounded border bg-slate-50 p-4">
          <h2 className="text-lg font-medium">{cashflowCopy.financeNavigationTitle}</h2>
          <p className="mt-1 text-sm text-slate-600">{cashflowCopy.financeNavigationHelper}</p>
          <div className="mt-3">
            <Link className="text-sm font-medium text-sky-700 underline" href="/invoices">
              {cashflowCopy.openInvoicesPageLink}
            </Link>
          </div>
        </section>
        <Home />
      </div>
    ),
    [cashflowCopy],
  );

  return content;
}
