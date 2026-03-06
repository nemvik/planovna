import { OperationService } from '../../modules/operation/operation.service';
import { protectedProcedure, router } from '../trpc';

export const createOperationRouter = (operationService: OperationService) =>
  router({
    list: protectedProcedure.query(({ ctx }) => {
      return operationService.list(ctx.auth.tenantId);
    }),
  });
