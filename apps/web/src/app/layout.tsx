import Link from 'next/link';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Planovna',
  description: 'Pilot-ready production planning and finance workspace.',
};

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/board', label: 'Board' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/cashflow', label: 'Cashflow' },
] as const;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-950 antialiased">
        <div className="min-h-screen">
          <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Planovna</p>
                <p className="text-sm text-slate-500">Operations and finance workspace</p>
              </div>
              <nav aria-label="Primary" className="flex flex-wrap gap-2">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
