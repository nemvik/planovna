import { z } from 'zod';
import { CustomerService } from '../../modules/customer/customer.service';
import { protectedProcedure, router } from '../trpc';

const CustomerCreateInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export const createCustomerRouter = (customerService: CustomerService) =>
  router({
    list: protectedProcedure.query(({ ctx }) => {
      return customerService.list(ctx.auth.tenantId);
    }),
    create: protectedProcedure
      .input(CustomerCreateInputSchema)
      .mutation(({ ctx, input }) => {
        return customerService.create({
          ...input,
          tenantId: ctx.auth.tenantId,
        });
      }),
  });
