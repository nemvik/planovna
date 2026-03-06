import { CashflowService } from '../../modules/cashflow/cashflow.service';
import { roleProtectedProcedure, router } from '../trpc';

const cashflowReadProcedure = roleProtectedProcedure(['OWNER', 'FINANCE']);

export const createCashflowRouter = (cashflowService: CashflowService) =>
  router({
    list: cashflowReadProcedure.query(({ ctx }) => {
      return cashflowService.list(ctx.auth.tenantId);
    }),
  });
