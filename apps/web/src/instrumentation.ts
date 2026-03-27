export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) {
    return;
  }

  const Sentry = await import('@sentry/nextjs');

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT?.trim(),
    release: process.env.SENTRY_RELEASE?.trim(),
    tracesSampleRate: 0,
  });
}
