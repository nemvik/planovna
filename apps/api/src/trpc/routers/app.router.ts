import { AuthService } from '../../modules/auth/auth.service';
import { CustomerService } from '../../modules/customer/customer.service';
import { InvoiceService } from '../../modules/invoice/invoice.service';
import { router } from '../trpc';
import { createAuthRouter } from './auth.router';
import { createCustomerRouter } from './customer.router';
import { createInvoiceRouter } from './invoice.router';

export const createAppRouter = (
  authService: AuthService,
  customerService: CustomerService,
  invoiceService: InvoiceService,
) =>
  router({
    auth: createAuthRouter(authService),
    customer: createCustomerRouter(customerService),
    invoice: createInvoiceRouter(invoiceService),
  });

export type AppRouter = ReturnType<typeof createAppRouter>;
