import { INestApplication, Logger } from '@nestjs/common';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { NextFunction, Request, Response } from 'express';
import { AuthService } from './modules/auth/auth.service';
import { CashflowService } from './modules/cashflow/cashflow.service';
import { CustomerService } from './modules/customer/customer.service';
import { InvoiceService } from './modules/invoice/invoice.service';
import { OperationService } from './modules/operation/operation.service';
import { OrderService } from './modules/order/order.service';
import { createTrpcContext } from './trpc/context';
import { createAppRouter } from './trpc/routers/app.router';

const API_CORS_ALLOWED_ORIGINS_ENV = 'API_CORS_ALLOWED_ORIGINS';
const PROD_DEFAULT_CORS_ALLOWED_ORIGINS = ['https://planovna.nemvik.com'];
const logger = new Logger('HttpAccess');

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

function getAllowedCorsOrigins(envValue = process.env[API_CORS_ALLOWED_ORIGINS_ENV]): string[] {
  if (!envValue) {
    if (process.env.NODE_ENV === 'production') {
      return PROD_DEFAULT_CORS_ALLOWED_ORIGINS;
    }

    return [];
  }

  return [
    ...new Set(
      envValue
        .split(',')
        .map((origin) => normalizeOrigin(origin))
        .filter(Boolean),
    ),
  ];
}

export function configureApiApp(app: INestApplication) {
  const authService = app.get(AuthService);
  const customerService = app.get(CustomerService);
  const invoiceService = app.get(InvoiceService);
  const orderService = app.get(OrderService);
  const operationService = app.get(OperationService);
  const cashflowService = app.get(CashflowService);
  const appRouter = createAppRouter(
    authService,
    customerService,
    invoiceService,
    orderService,
    operationService,
    cashflowService,
  );
  const allowedCorsOrigins = getAllowedCorsOrigins();

  app.enableCors({
    credentials: true,
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (origin && allowedCorsOrigins.includes(normalizeOrigin(origin))) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now();

    res.on('finish', () => {
      logger.log(
        `${req.method} ${req.originalUrl ?? req.url} ${res.statusCode} ${Date.now() - startedAt}ms`,
      );
    });

    next();
  });

  app.use('/trpc', (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'OPTIONS') {
      next();
      return;
    }

    const requestOrigin = req.headers.origin;
    if (
      typeof requestOrigin === 'string' &&
      allowedCorsOrigins.includes(normalizeOrigin(requestOrigin))
    ) {
      const requestHeaders = req.headers['access-control-request-headers'];
      const allowHeaders =
        typeof requestHeaders === 'string' && requestHeaders.trim().length > 0
          ? requestHeaders
          : 'content-type,authorization';

      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', allowHeaders);
      res.status(204).end();
      return;
    }

    res.status(204).end();
  });

  app.use(
    '/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext: ({ req }) =>
        createTrpcContext({ req, authService }),
    }),
  );
}
