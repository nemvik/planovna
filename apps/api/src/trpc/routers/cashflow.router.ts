import { TRPCError } from '@trpc/server';
import { CashflowService } from '../../modules/cashflow/cashflow.service';
import {
  CreateRecurringCashflowRuleSchema,
  RecurringCashflowRuleActionSchema,
  UpdateRecurringCashflowRuleSchema,
} from '../../modules/cashflow/dto/recurring-cashflow.dto';
import { roleProtectedProcedure, router } from '../trpc';

const cashflowReadProcedure = roleProtectedProcedure(['OWNER', 'FINANCE']);

export const createCashflowRouter = (cashflowService: CashflowService) =>
  router({
    list: cashflowReadProcedure.query(({ ctx }) => {
      return cashflowService.list(ctx.auth.tenantId);
    }),
    listRecurringRules: cashflowReadProcedure.query(({ ctx }) => {
      return cashflowService.listRecurringRules(ctx.auth.tenantId);
    }),
    createRecurringRule: cashflowReadProcedure
      .input(CreateRecurringCashflowRuleSchema)
      .mutation(({ ctx, input }) => {
        return cashflowService.createRecurringRule(ctx.auth.tenantId, input);
      }),
    updateRecurringRule: cashflowReadProcedure
      .input(UpdateRecurringCashflowRuleSchema)
      .mutation(async ({ ctx, input }) => {
        try {
          const result = await cashflowService.updateRecurringRule(ctx.auth.tenantId, input);
          if (!result) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Recurring rule access denied' });
          }
          return result;
        } catch (error) {
          if (error instanceof Error && error.message === 'VERSION_CONFLICT') {
            throw new TRPCError({ code: 'CONFLICT', message: 'Recurring rule version conflict' });
          }
          throw error;
        }
      }),
    pauseRecurringRule: cashflowReadProcedure
      .input(RecurringCashflowRuleActionSchema)
      .mutation(async ({ ctx, input }) => {
        try {
          const result = await cashflowService.pauseRecurringRule(ctx.auth.tenantId, input);
          if (!result) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Recurring rule access denied' });
          }
          return result;
        } catch (error) {
          if (error instanceof Error && error.message === 'VERSION_CONFLICT') {
            throw new TRPCError({ code: 'CONFLICT', message: 'Recurring rule version conflict' });
          }
          throw error;
        }
      }),
    resumeRecurringRule: cashflowReadProcedure
      .input(RecurringCashflowRuleActionSchema)
      .mutation(async ({ ctx, input }) => {
        try {
          const result = await cashflowService.resumeRecurringRule(ctx.auth.tenantId, input);
          if (!result) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Recurring rule access denied' });
          }
          return result;
        } catch (error) {
          if (error instanceof Error && error.message === 'VERSION_CONFLICT') {
            throw new TRPCError({ code: 'CONFLICT', message: 'Recurring rule version conflict' });
          }
          throw error;
        }
      }),
    stopRecurringRule: cashflowReadProcedure
      .input(RecurringCashflowRuleActionSchema)
      .mutation(async ({ ctx, input }) => {
        try {
          const result = await cashflowService.stopRecurringRule(ctx.auth.tenantId, input);
          if (!result) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Recurring rule access denied' });
          }
          return result;
        } catch (error) {
          if (error instanceof Error && error.message === 'VERSION_CONFLICT') {
            throw new TRPCError({ code: 'CONFLICT', message: 'Recurring rule version conflict' });
          }
          throw error;
        }
      }),
    removeRecurringRule: cashflowReadProcedure
      .input(RecurringCashflowRuleActionSchema)
      .mutation(async ({ ctx, input }) => {
        try {
          const result = await cashflowService.removeRecurringRule(ctx.auth.tenantId, input);
          if (!result) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Recurring rule access denied' });
          }
          return result;
        } catch (error) {
          if (error instanceof Error && error.message === 'VERSION_CONFLICT') {
            throw new TRPCError({ code: 'CONFLICT', message: 'Recurring rule version conflict' });
          }
          throw error;
        }
      }),
  });
