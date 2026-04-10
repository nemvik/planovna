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
    return <HomeWorkspace />;
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
