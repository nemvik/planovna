import { Logger } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApiApp } from './bootstrap';
import { resolveTokenSecret } from './modules/auth/auth.service';
import { SentryExceptionFilter } from './observability/sentry-exception.filter';
import {
  captureApiException,
  flushApiSentry,
  initApiSentry,
  isApiSentryEnabled,
} from './observability/sentry';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  resolveTokenSecret();
  initApiSentry();

  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.useGlobalFilters(new SentryExceptionFilter(app.get(HttpAdapterHost)));
  configureApiApp(app);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  logger.log(`API listening on port ${port}`);
  logger.log(
    isApiSentryEnabled()
      ? 'API monitoring baseline active: Sentry + access/error logs'
      : 'API monitoring baseline active: access/error logs (Sentry disabled: missing SENTRY_DSN)',
  );
}

process.on('unhandledRejection', (reason) => {
  captureApiException(reason, { process: { signal: 'unhandledRejection' } });
  logger.error('Unhandled promise rejection', reason instanceof Error ? reason.stack : undefined);
});

process.on('uncaughtException', async (error) => {
  captureApiException(error, { process: { signal: 'uncaughtException' } });
  logger.error('Uncaught exception', error.stack);
  await flushApiSentry();
  process.exit(1);
});

bootstrap().catch(async (error: unknown) => {
  captureApiException(error, { process: { signal: 'bootstrap' } });

  if (error instanceof Error) {
    logger.error(error.message, error.stack);
  } else {
    logger.error(String(error));
  }

  await flushApiSentry();
  process.exit(1);
});
