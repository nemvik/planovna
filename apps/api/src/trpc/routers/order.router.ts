import { TRPCError } from '@trpc/server';
import { OrderService } from '../../modules/order/order.service';
import {
  CreateOrderSchema,
  UpdateOrderSchema,
} from '../../modules/order/dto/order.dto';
import { throwTrpcVersionConflict } from '../errors/version-conflict';
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
      .mutation(async ({ ctx, input }) => {
        try {
          const result = await orderService.update({
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
        } catch (error) {
          throwTrpcVersionConflict(error);
        }
      }),
  });
