'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/orders', label: 'Orders' },
  { href: '/board', label: 'Board' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/cashflow', label: 'Cashflow' },
] as const;

export default function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-4 flex flex-wrap gap-2 text-sm font-medium" aria-label="Primary">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={
              isActive
                ? 'rounded-lg bg-slate-900 px-3 py-2 text-white'
                : 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900'
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
