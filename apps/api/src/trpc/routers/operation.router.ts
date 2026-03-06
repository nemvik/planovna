import { OperationService } from '../../modules/operation/operation.service';
import { CreateOperationSchema } from '../../modules/operation/dto/operation.dto';
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
  });
