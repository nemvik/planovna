import Link from 'next/link';

export default function InvoicesPage() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl p-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-sky-700">Finance module</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Invoices</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-600">
          Invoice work is now separated from the homepage. Use this module entry page for invoice
          navigation while the dashboard stays lightweight.
        </p>
      </header>
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Invoice workspace</h2>
          <p className="mt-2 text-sm text-slate-600">
            Review invoice-focused summaries and continue into the operational board when you need
            to work with the full shared workspace.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white" href="/board">
              Open board workspace
            </Link>
            <Link className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900" href="/cashflow">
              Open cashflow
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
