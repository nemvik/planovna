import { AuthService } from '../../modules/auth/auth.service';
import { CashflowService } from '../../modules/cashflow/cashflow.service';
import { CustomerService } from '../../modules/customer/customer.service';
import { InvoiceService } from '../../modules/invoice/invoice.service';
import { OperationService } from '../../modules/operation/operation.service';
import { OrderService } from '../../modules/order/order.service';
import { router } from '../trpc';
import { createAuthRouter } from './auth.router';
import { createCashflowRouter } from './cashflow.router';
import { createCustomerRouter } from './customer.router';
import { createInvoiceRouter } from './invoice.router';
import { createOperationRouter } from './operation.router';
import { createOrderRouter } from './order.router';

export const createAppRouter = (
  authService: AuthService,
  customerService: CustomerService,
  invoiceService: InvoiceService,
  orderService: OrderService,
  operationService: OperationService,
  cashflowService: CashflowService,
) =>
  router({
    auth: createAuthRouter(authService),
    customer: createCustomerRouter(customerService),
    invoice: createInvoiceRouter(invoiceService),
    order: createOrderRouter(orderService),
    operation: createOperationRouter(operationService),
    cashflow: createCashflowRouter(cashflowService),
  });

export type AppRouter = ReturnType<typeof createAppRouter>;
