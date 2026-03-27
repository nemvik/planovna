import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import type { Request } from 'express';
import { captureApiException } from './sentry';

@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(SentryExceptionFilter.name);

  constructor(adapterHost: HttpAdapterHost) {
    super(adapterHost.httpAdapter);
  }

  override catch(exception: unknown, host: ArgumentsHost) {
    const contextType = host.getType<'http' | 'rpc' | 'ws'>();

    if (contextType === 'http') {
      const http = host.switchToHttp();
      const request = http.getRequest<Request>();
      const status =
        exception instanceof HttpException
          ? exception.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;

      captureApiException(exception, {
        http: {
          method: request.method,
          path: request.originalUrl ?? request.url,
          status,
        },
      });

      this.logger.error(
        `${request.method} ${request.originalUrl ?? request.url} failed with ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      captureApiException(exception, { transport: { type: contextType } });
      this.logger.error(
        `Unhandled ${contextType} exception`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    super.catch(exception, host);
  }
}
