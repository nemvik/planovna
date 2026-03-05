import { AuthService } from '../../modules/auth/auth.service';
import { CustomerService } from '../../modules/customer/customer.service';
import { router } from '../trpc';
import { createAuthRouter } from './auth.router';
import { createCustomerRouter } from './customer.router';

export const createAppRouter = (
  authService: AuthService,
  customerService: CustomerService,
) =>
  router({
    auth: createAuthRouter(authService),
    customer: createCustomerRouter(customerService),
  });

export type AppRouter = ReturnType<typeof createAppRouter>;
