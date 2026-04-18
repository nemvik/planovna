import type { Metadata } from 'next';
import AppNav from './app-nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Planovna',
  description: 'Orders, planning, invoices, and cashflow in one practical workflow.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_45%,_#f8fafc_100%)] text-slate-950 antialiased">
        <AppNav />
        {children}
      </body>
    </html>
  );
}
