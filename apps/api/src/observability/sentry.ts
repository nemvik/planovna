import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';

const logger = new Logger('Observability');
const API_SENTRY_DSN = process.env.SENTRY_DSN?.trim();
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT?.trim();
const SENTRY_RELEASE = process.env.SENTRY_RELEASE?.trim();

let sentryInitialized = false;

export function initApiSentry() {
  if (!API_SENTRY_DSN || sentryInitialized) {
    return;
  }

  Sentry.init({
    dsn: API_SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: SENTRY_RELEASE,
    tracesSampleRate: 0,
  });

  sentryInitialized = true;
  logger.log('Sentry monitoring enabled for API runtime');
}

export function isApiSentryEnabled() {
  return sentryInitialized;
}

export function captureApiException(error: unknown, context?: Record<string, unknown>) {
  if (!sentryInitialized) {
    return;
  }

  Sentry.withScope((scope) => {
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        scope.setContext(key, value as Record<string, unknown>);
      }
    }

    if (error instanceof Error) {
      Sentry.captureException(error);
      return;
    }

    Sentry.captureMessage(typeof error === 'string' ? error : 'Unknown API exception');
  });
}

export async function flushApiSentry(timeoutMs = 2000) {
  if (!sentryInitialized) {
    return true;
  }

  return Sentry.flush(timeoutMs);
}
