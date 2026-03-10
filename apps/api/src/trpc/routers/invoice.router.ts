import { TRPCError } from '@trpc/server';
import { InvoiceService } from '../../modules/invoice/invoice.service';
import {
  CreateInvoiceSchema,
  MarkPaidSchema,
} from '../../modules/invoice/dto/invoice.dto';
import { throwTrpcVersionConflict } from '../errors/version-conflict';
import { roleProtectedProcedure, router } from '../trpc';

const invoiceReadProcedure = roleProtectedProcedure(['OWNER', 'FINANCE']);
const invoiceWriteProcedure = roleProtectedProcedure(['OWNER', 'FINANCE']);

export const createInvoiceRouter = (invoiceService: InvoiceService) =>
  router({
    list: invoiceReadProcedure.query(async ({ ctx }) => {
      return await invoiceService.list(ctx.auth.tenantId);
    }),
    issue: invoiceWriteProcedure
      .input(CreateInvoiceSchema)
      .mutation(async ({ ctx, input }) => {
        return await invoiceService.issue(ctx.auth.tenantId, input);
      }),
    paid: invoiceWriteProcedure
      .input(MarkPaidSchema)
      .mutation(async ({ ctx, input }) => {
        try {
          const result = await invoiceService.markPaid(ctx.auth.tenantId, input);
          if (!result) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Invoice access denied',
            });
          }

          return result;
        } catch (error) {
          throwTrpcVersionConflict(error);
        }
      }),
  });
