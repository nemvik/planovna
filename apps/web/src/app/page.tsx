'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import HomeWorkspace, { HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY } from './home-workspace';

const dashboardCards = [
  {
    href: '/orders',
    title: 'Orders',
    description: 'Go here first when a new job starts and you need the order queue in view.',
    action: 'Open orders',
  },
  {
    href: '/board',
    title: 'Board',
    description: 'Go here when an order is ready to move into planning and scheduling.',
    action: 'Open board',
  },
  {
    href: '/invoices',
    title: 'Invoices',
    description: 'Go here when planned work needs invoice review and finance document follow-up.',
    action: 'Open invoices',
  },
  {
    href: '/cashflow',
    title: 'Cashflow',
    description: 'Go here when invoice follow-up needs the cashflow timeline and payment context.',
    action: 'Open cashflow',
  },
] as const;

export { HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY };

export default function Home() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    const syncSession = () => {
      const token = window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY);
      setHasSession(typeof token === 'string' && token.length > 0);
    };

    syncSession();
    window.addEventListener('storage', syncSession);
    return () => window.removeEventListener('storage', syncSession);
  }, []);

  if (hasSession === null) {
    return <main className="mx-auto min-h-screen max-w-6xl p-6 text-slate-600">Loading…</main>;
  }

  if (!hasSession) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl p-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-wide text-sky-700">Planovna</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold text-slate-950">
            Planning and finance flow for small production and operations teams.
          </h1>
          <p className="mt-4 max-w-3xl text-base text-slate-600">
            Planovna helps teams move from orders into planning, then into invoices and cashflow,
            without losing the thread between operational work and finance follow-up.
          </p>
          <p className="mt-3 max-w-3xl text-sm text-slate-500">
            Built for owner-led teams who need one practical workspace instead of scattered boards,
            spreadsheets, and finance notes.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white" href="/register">
              Create account
            </Link>
            <Link className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900" href="/board">
              Log in
            </Link>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Orders</h2>
            <p className="mt-2 text-sm text-slate-600">
              Start with incoming work, clarify what needs to happen, and keep the queue visible.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Board</h2>
            <p className="mt-2 text-sm text-slate-600">
              Move work into planning, schedule the next step, and keep production flow clear.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Invoices</h2>
            <p className="mt-2 text-sm text-slate-600">
              Review invoice status and finance documents once planned work is ready to bill.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Cashflow</h2>
            <p className="mt-2 text-sm text-slate-600">
              Follow the finance timeline after invoicing and keep incoming cash visible.
            </p>
          </article>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-xl font-semibold text-slate-900">Pilot-ready, practical, and flow-first</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              One shared flow from order intake to finance follow-up.
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              Clear module boundaries, so planning and finance each stay readable.
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              Lightweight enough for daily use, without pretending to be a giant ERP suite.
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-950">Start with orders, then carry the flow through.</h2>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">
            Create your workspace, log in, and move from planning to invoicing and cashflow in one connected product flow.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white" href="/register">
              Create account
            </Link>
            <Link className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900" href="/board">
              Log in
            </Link>
          </div>
        </section>

        <footer className="mt-8 border-t border-slate-200 pt-6 text-sm text-slate-500">
          Planovna, orders to planning to invoices to cashflow.
        </footer>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl p-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-sky-700">Planovna</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Dashboard</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-600">
          Move through the product in a simple flow: Orders, then Board, then Invoices, then Cashflow.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white" href="/orders">
            Open orders
          </Link>
          <Link className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900" href="/board">
            Open board
          </Link>
          <Link className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900" href="/invoices">
            Open invoices
          </Link>
          <Link className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900" href="/cashflow">
            Open cashflow
          </Link>
        </div>
      </header>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboardCards.map((card) => (
          <article key={card.href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{card.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{card.description}</p>
            <Link className="mt-4 inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900" href={card.href}>
              {card.action}
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
