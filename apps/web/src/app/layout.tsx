import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Geist, Geist_Mono } from 'next/font/google';
import { resolveSupportedLocaleFromValue, type SupportedLocale } from '../lib/locale';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const DEFAULT_LOCALE: SupportedLocale = 'en';

const LAYOUT_COPY: Record<SupportedLocale, { title: string; description: string }> = {
  cs: {
    title: 'Planovna',
    description: 'Plánovací nástroj pro výrobu.',
  },
  en: {
    title: 'Planovna',
    description: 'Production planning workspace.',
  },
  de: {
    title: 'Planovna',
    description: 'Arbeitsbereich für Produktionsplanung.',
  },
};

const resolveServerLocale = async (): Promise<SupportedLocale> => {
  const requestHeaders = await headers();
  const acceptedLanguage = requestHeaders.get('accept-language');

  return resolveSupportedLocaleFromValue(acceptedLanguage) ?? DEFAULT_LOCALE;
};

export const generateMetadata = async (): Promise<Metadata> => {
  const locale = await resolveServerLocale();

  return LAYOUT_COPY[locale];
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await resolveServerLocale();

  return (
    <html lang={locale}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
