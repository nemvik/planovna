import { AuthService } from '../../modules/auth/auth.service';
import { CustomerService } from '../../modules/customer/customer.service';
import { InvoiceService } from '../../modules/invoice/invoice.service';
import { OrderService } from '../../modules/order/order.service';
import { router } from '../trpc';
import { createAuthRouter } from './auth.router';
import { createCustomerRouter } from './customer.router';
import { createInvoiceRouter } from './invoice.router';
import { createOrderRouter } from './order.router';

export const createAppRouter = (
  authService: AuthService,
  customerService: CustomerService,
  invoiceService: InvoiceService,
  orderService: OrderService,
) =>
  router({
    auth: createAuthRouter(authService),
    customer: createCustomerRouter(customerService),
    invoice: createInvoiceRouter(invoiceService),
    order: createOrderRouter(orderService),
  });

export type AppRouter = ReturnType<typeof createAppRouter>;
