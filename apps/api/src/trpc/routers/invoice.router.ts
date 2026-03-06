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
    list: invoiceReadProcedure.query(({ ctx }) => {
      return invoiceService.list(ctx.auth.tenantId);
    }),
    issue: invoiceWriteProcedure
      .input(CreateInvoiceSchema)
      .mutation(({ ctx, input }) => {
        return invoiceService.issue(ctx.auth.tenantId, input);
      }),
    paid: invoiceWriteProcedure
      .input(MarkPaidSchema)
      .mutation(({ ctx, input }) => {
        try {
          const result = invoiceService.markPaid(ctx.auth.tenantId, input);
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
