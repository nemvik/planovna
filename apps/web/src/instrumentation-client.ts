import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT?.trim(),
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE?.trim(),
    tracesSampleRate: 0,
  });
}
