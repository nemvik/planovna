import { TRPCError } from '@trpc/server';
import { OperationService } from '../../modules/operation/operation.service';
import {
  CreateOperationSchema,
  UpdateOperationSchema,
} from '../../modules/operation/dto/operation.dto';
import { protectedProcedure, router } from '../trpc';

export const createOperationRouter = (operationService: OperationService) =>
  router({
    list: protectedProcedure.query(({ ctx }) => {
      return operationService.list(ctx.auth.tenantId);
    }),
    create: protectedProcedure
      .input(CreateOperationSchema)
      .mutation(({ ctx, input }) => {
        return operationService.create({
          ...input,
          tenantId: ctx.auth.tenantId,
        });
      }),
    update: protectedProcedure
      .input(UpdateOperationSchema)
      .mutation(({ ctx, input }) => {
        const result = operationService.update({
          ...input,
          tenantId: ctx.auth.tenantId,
        });

        if (!result) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Operation access denied',
          });
        }

        return result;
      }),
  });
