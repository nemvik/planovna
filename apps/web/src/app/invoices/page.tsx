"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { resolveSupportedLocale } from '../../lib/locale';
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

type InvoicesPageLocaleStrings = {
  localeTag: string;
  sectionEyebrow: string;
  pageTitle: string;
  pageIntro: string;
  exportActionsAriaLabel: string;
  exportActionsTitle: string;
  exportActionsHelper: string;
  exportPathTemplate: string;
  openHomepageFinanceWorkspaceLink: string;
  openCashflowPageLink: string;
  statusSummaryAriaLabel: string;
  statusSummaryTitle: string;
  totalInvoicesLabel: string;
  issuedLabel: string;
  paidLabel: string;
  invoiceStatusDraft: string;
  invoiceStatusIssued: string;
  invoiceStatusPaid: string;
  invoiceListAriaLabel: string;
  recentInvoicesTitle: string;
  loginToLoadHint: string;
  noInvoicesHint: string;
  noDueDate: string;
  exportPdfForTemplate: string;
};

const INVOICES_PAGE_LOCALES: Record<'cs' | 'en' | 'de', InvoicesPageLocaleStrings> = {
  cs: {
    localeTag: 'cs-CZ',
    sectionEyebrow: 'Finanční přehled',
    pageTitle: 'Faktury',
    pageIntro: 'Dedikovaný přehled faktur postavený na stejném nasazeném kontraktu homepage financí a exportu.',
    exportActionsAriaLabel: 'Akce exportu faktur',
    exportActionsTitle: 'Akce exportu faktur',
    exportActionsHelper: 'Použijte nasazený základní vzor PDF export cesty při práci s konkrétním ID faktury.',
    exportPathTemplate: '/invoices/<invoiceId>/pdf',
    openHomepageFinanceWorkspaceLink: 'Otevřít finanční pracovní prostor na homepage',
    openCashflowPageLink: 'Otevřít stránku peněžního toku',
    statusSummaryAriaLabel: 'Souhrn stavu faktur',
    statusSummaryTitle: 'Souhrn stavu faktur',
    totalInvoicesLabel: 'Celkem faktur',
    issuedLabel: 'Vystavené',
    paidLabel: 'Zaplacené',
    invoiceStatusDraft: 'Koncept',
    invoiceStatusIssued: 'Vystaveno',
    invoiceStatusPaid: 'Zaplaceno',
    invoiceListAriaLabel: 'Seznam faktur',
    recentInvoicesTitle: 'Nedávné faktury',
    loginToLoadHint: 'Pro načtení dat faktur se přihlaste na homepage.',
    noInvoicesHint: 'Zatím nejsou dostupné žádné faktury.',
    noDueDate: 'Bez data splatnosti',
    exportPdfForTemplate: 'Exportovat PDF pro {invoiceNumber}',
  },
  en: {
    localeTag: 'en-US',
    sectionEyebrow: 'Finance',
    pageTitle: 'Invoices',
    pageIntro: 'Dedicated invoice view built on the same shipped homepage finance and export contract.',
    exportActionsAriaLabel: 'Invoice export actions',
    exportActionsTitle: 'Invoice export actions',
    exportActionsHelper: 'Use the shipped PDF export baseline path pattern when working with a concrete invoice ID.',
    exportPathTemplate: '/invoices/<invoiceId>/pdf',
    openHomepageFinanceWorkspaceLink: 'Open homepage finance workspace',
    openCashflowPageLink: 'Open cashflow page',
    statusSummaryAriaLabel: 'Invoice status summary',
    statusSummaryTitle: 'Invoice status summary',
    totalInvoicesLabel: 'Total invoices',
    issuedLabel: 'Issued',
    paidLabel: 'Paid',
    invoiceStatusDraft: 'Draft',
    invoiceStatusIssued: 'Issued',
    invoiceStatusPaid: 'Paid',
    invoiceListAriaLabel: 'Invoice list',
    recentInvoicesTitle: 'Recent invoices',
    loginToLoadHint: 'Log in on the homepage to load invoice data.',
    noInvoicesHint: 'No invoices available yet.',
    noDueDate: 'No due date',
    exportPdfForTemplate: 'Export PDF for {invoiceNumber}',
  },
  de: {
    localeTag: 'de-DE',
    sectionEyebrow: 'Finanzen',
    pageTitle: 'Rechnungen',
    pageIntro: 'Dedizierte Rechnungsansicht auf Basis desselben ausgelieferten Homepage-Finanz- und Export-Vertrags.',
    exportActionsAriaLabel: 'Rechnungsexport-Aktionen',
    exportActionsTitle: 'Rechnungsexport-Aktionen',
    exportActionsHelper: 'Verwenden Sie beim Arbeiten mit einer konkreten Rechnungs-ID das ausgelieferte PDF-Export-Basispfadmuster.',
    exportPathTemplate: '/invoices/<invoiceId>/pdf',
    openHomepageFinanceWorkspaceLink: 'Homepage-Finanz-Workspace öffnen',
    openCashflowPageLink: 'Cashflow-Seite öffnen',
    statusSummaryAriaLabel: 'Rechnungsstatus-Zusammenfassung',
    statusSummaryTitle: 'Rechnungsstatus-Zusammenfassung',
    totalInvoicesLabel: 'Rechnungen gesamt',
    issuedLabel: 'Ausgestellt',
    paidLabel: 'Bezahlt',
    invoiceStatusDraft: 'Entwurf',
    invoiceStatusIssued: 'Ausgestellt',
    invoiceStatusPaid: 'Bezahlt',
    invoiceListAriaLabel: 'Rechnungsliste',
    recentInvoicesTitle: 'Neueste Rechnungen',
    loginToLoadHint: 'Melden Sie sich auf der Homepage an, um Rechnungsdaten zu laden.',
    noInvoicesHint: 'Noch keine Rechnungen verfügbar.',
    noDueDate: 'Kein Fälligkeitsdatum',
    exportPdfForTemplate: 'PDF exportieren für {invoiceNumber}',
  },
};

const formatMoney = (
  amount: number,
  currency: InvoiceSummary['currency'],
  localeTag: string,
) =>
  new Intl.NumberFormat(localeTag, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);


const formatDateForDisplay = (value: string, localeTag: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return new Intl.DateTimeFormat(localeTag, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(date);
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [hasToken, setHasToken] = useState(false);

  const invoicesCopy = INVOICES_PAGE_LOCALES[resolveSupportedLocale()];

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

  const invoiceSummary = useMemo(() => {
    const issuedCount = invoices.filter((invoice) => invoice.status === 'ISSUED').length;
    const paidCount = invoices.filter((invoice) => invoice.status === 'PAID').length;

    return {
      issuedCount,
      paidCount,
      totalCount: invoices.length,
    };
  }, [invoices]);


  const getLocalizedInvoiceStatus = (status: InvoiceSummary['status']) => {
    switch (status) {
      case 'DRAFT':
        return invoicesCopy.invoiceStatusDraft;
      case 'ISSUED':
        return invoicesCopy.invoiceStatusIssued;
      case 'PAID':
        return invoicesCopy.invoiceStatusPaid;
      default:
        return status;
    }
  };

  const content = useMemo(
    () => (
      <div className="space-y-4">
        <header className="space-y-1">
          <p className="text-sm font-medium text-slate-500">{invoicesCopy.sectionEyebrow}</p>
          <h1 className="text-2xl font-semibold">{invoicesCopy.pageTitle}</h1>
          <p className="text-sm text-slate-600">{invoicesCopy.pageIntro}</p>
        </header>
        <section aria-label={invoicesCopy.exportActionsAriaLabel} className="rounded border bg-slate-50 p-4">
          <h2 className="text-lg font-medium">{invoicesCopy.exportActionsTitle}</h2>
          <p className="mt-1 text-sm text-slate-600">{invoicesCopy.exportActionsHelper}</p>
          <code className="mt-3 block rounded bg-white px-3 py-2 text-sm text-slate-800">
            {invoicesCopy.exportPathTemplate}
          </code>
          <div className="mt-3 flex items-center gap-3">
            <Link className="text-sm font-medium text-sky-700 underline" href="/">
              {invoicesCopy.openHomepageFinanceWorkspaceLink}
            </Link>
            <Link className="text-sm font-medium text-sky-700 underline" href="/cashflow">
              {invoicesCopy.openCashflowPageLink}
            </Link>
          </div>
        </section>
        <section aria-label={invoicesCopy.statusSummaryAriaLabel} className="rounded border bg-slate-50 p-4">
          <h2 className="text-lg font-medium">{invoicesCopy.statusSummaryTitle}</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded border bg-white p-3">
              <p className="text-sm text-slate-500">{invoicesCopy.totalInvoicesLabel}</p>
              <p className="text-lg font-semibold">{invoiceSummary.totalCount}</p>
            </div>
            <div className="rounded border bg-white p-3">
              <p className="text-sm text-slate-500">{invoicesCopy.issuedLabel}</p>
              <p className="text-lg font-semibold">{invoiceSummary.issuedCount}</p>
            </div>
            <div className="rounded border bg-white p-3">
              <p className="text-sm text-slate-500">{invoicesCopy.paidLabel}</p>
              <p className="text-lg font-semibold">{invoiceSummary.paidCount}</p>
            </div>
          </div>
        </section>
        <section aria-label={invoicesCopy.invoiceListAriaLabel} className="rounded border bg-slate-50 p-4">
          <h2 className="text-lg font-medium">{invoicesCopy.recentInvoicesTitle}</h2>
          {!hasToken ? (
            <p className="mt-1 text-sm text-slate-600">{invoicesCopy.loginToLoadHint}</p>
          ) : invoices.length === 0 ? (
            <p className="mt-1 text-sm text-slate-600">{invoicesCopy.noInvoicesHint}</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {invoices.map((invoice) => (
                <li key={invoice.id} className="rounded border bg-white px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{invoice.number}</span>
                    <span>{getLocalizedInvoiceStatus(invoice.status)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3 text-slate-600">
                    <span>{formatMoney(invoice.amountGross, invoice.currency, invoicesCopy.localeTag)}</span>
                    <span>{invoice.dueAt ? formatDateForDisplay(invoice.dueAt, invoicesCopy.localeTag) : invoicesCopy.noDueDate}</span>
                  </div>
                  <div className="mt-2">
                    <Link className="text-sm font-medium text-sky-700 underline" href={invoice.pdfPath}>
                      {invoicesCopy.exportPdfForTemplate.replace('{invoiceNumber}', invoice.number)}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <Home />
      </div>
    ),
    [hasToken, invoiceSummary, invoices, invoicesCopy],
  );

  return content;
}
