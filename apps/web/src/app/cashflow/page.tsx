import Link from 'next/link';

export default function CashflowPage() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl p-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-sky-700">Finance module</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Cashflow</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-600">
          Cashflow now has a dedicated module page. Use this entry point for finance navigation and
          keep the homepage focused on quick orientation.
        </p>
      </header>
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Cashflow workspace</h2>
          <p className="mt-2 text-sm text-slate-600">
            Review cashflow-focused summaries here and jump into the board when operational work is
            needed.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white" href="/board">
              Open board workspace
            </Link>
            <Link className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900" href="/invoices">
              Open invoices
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
