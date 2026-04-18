'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AppShell from './app-shell';
import HomeWorkspace, { HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY } from './home-workspace';

const dashboardCards = [
  {
    href: '/orders',
    title: 'Orders',
    description: 'Start with incoming work and keep the queue visible before anything moves into planning.',
    action: 'Open orders',
  },
  {
    href: '/board',
    title: 'Board',
    description: 'Move prepared work into planning and scheduling when the next operational step is clear.',
    action: 'Open board',
  },
  {
    href: '/invoices',
    title: 'Invoices',
    description: 'Review invoice status, update finance details, and keep billing follow-up readable.',
    action: 'Open invoices',
  },
  {
    href: '/cashflow',
    title: 'Cashflow',
    description: 'Track the finance timeline after invoicing, from planned incoming cash to actual payments.',
    action: 'Open cashflow',
  },
] as const;

const flowHighlights = [
  'Orders frame the operational queue and priority.',
  'Board stays the planning handoff once work is ready.',
  'Invoices and Cashflow keep finance follow-up visible without losing context.',
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
    <AppShell
      title="Dashboard"
      description="Move through the product in a simple flow: Orders, then Board, then Invoices, then Cashflow."
      note="Use the same signed-in shell across modules, with the current step and next step kept easy to scan."
      actions={
        <>
          <Link className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm" href="/orders">
            Open orders
          </Link>
          <Link className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900" href="/board">
            Open board
          </Link>
          <Link className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900" href="/invoices">
            Open invoices
          </Link>
          <Link className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900" href="/cashflow">
            Open cashflow
          </Link>
        </>
      }
    >
      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-4 md:grid-cols-2">
          {dashboardCards.map((card) => (
            <article key={card.href} className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.3)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Module</p>
              <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">{card.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{card.description}</p>
              <Link className="mt-5 inline-flex rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900" href={card.href}>
                {card.action}
              </Link>
            </article>
          ))}
        </div>
        <aside className="rounded-[1.75rem] border border-slate-200/80 bg-slate-950 p-6 text-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.55)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">Flow focus</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">One product flow, four readable stops.</h2>
          <div className="mt-6 space-y-3">
            {flowHighlights.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
