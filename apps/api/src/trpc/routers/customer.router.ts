import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { CustomerService } from '../../modules/customer/customer.service';
import { UpdateCustomerSchema } from '../../modules/customer/dto/customer.dto';
import { throwTrpcVersionConflict } from '../errors/version-conflict';
import { protectedProcedure, router } from '../trpc';

const CustomerCreateInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
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
    update: protectedProcedure
      .input(UpdateCustomerSchema)
      .mutation(({ ctx, input }) => {
        try {
          const result = customerService.update({
            ...input,
            tenantId: ctx.auth.tenantId,
          });

          if (!result) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Customer access denied',
            });
          }

          return result;
        } catch (error) {
          throwTrpcVersionConflict(error);
        }
      }),
  });
