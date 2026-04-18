'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/', label: 'Dashboard' },
  { href: '/orders', label: 'Orders' },
  { href: '/board', label: 'Board' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/cashflow', label: 'Cashflow' },
] as const;

export default function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur" aria-label="Primary">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4 lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">Planovna</p>
          <p className="mt-1 text-sm text-slate-500">Orders to planning to finance</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-1.5 shadow-sm">
          {items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={
                  isActive
                    ? 'rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm'
                    : 'rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-white hover:text-slate-950'
                }
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
