import { INestApplication } from '@nestjs/common';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { AuthService } from './modules/auth/auth.service';
import { CashflowService } from './modules/cashflow/cashflow.service';
import { CustomerService } from './modules/customer/customer.service';
import { InvoiceService } from './modules/invoice/invoice.service';
import { OperationService } from './modules/operation/operation.service';
import { OrderService } from './modules/order/order.service';
import { createTrpcContext } from './trpc/context';
import { createAppRouter } from './trpc/routers/app.router';

const API_CORS_ALLOWED_ORIGINS_ENV = 'API_CORS_ALLOWED_ORIGINS';

function getAllowedCorsOrigins(envValue = process.env[API_CORS_ALLOWED_ORIGINS_ENV]): string[] {
  if (!envValue) {
    return [];
  }

  return [...new Set(envValue.split(',').map((origin) => origin.trim()).filter(Boolean))];
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
      if (origin && allowedCorsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
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
