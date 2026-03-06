import { TRPCError } from '@trpc/server';
import { OrderService } from '../../modules/order/order.service';
import {
  CreateOrderSchema,
  UpdateOrderSchema,
} from '../../modules/order/dto/order.dto';
import { protectedProcedure, router } from '../trpc';

export const createOrderRouter = (orderService: OrderService) =>
  router({
    list: protectedProcedure.query(({ ctx }) => {
      return orderService.list(ctx.auth.tenantId);
    }),
    create: protectedProcedure
      .input(CreateOrderSchema)
      .mutation(({ ctx, input }) => {
        return orderService.create({
          ...input,
          tenantId: ctx.auth.tenantId,
        });
      }),
    update: protectedProcedure
      .input(UpdateOrderSchema)
      .mutation(({ ctx, input }) => {
        const result = orderService.update({
          ...input,
          tenantId: ctx.auth.tenantId,
        });

        if (!result) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Order access denied',
          });
        }

        return result;
      }),
  });
