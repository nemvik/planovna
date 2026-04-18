import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { InvoiceService } from '../../modules/invoice/invoice.service';
import { CancelInvoiceSchema, GetInvoiceByIdSchema, MarkPaidSchema, UpdateInvoiceSchema } from '../../modules/invoice/dto/invoice.dto';
import { throwTrpcVersionConflict } from '../errors/version-conflict';
import { roleProtectedProcedure, router } from '../trpc';

const invoiceReadProcedure = roleProtectedProcedure(['OWNER', 'FINANCE']);
const invoiceWriteProcedure = roleProtectedProcedure(['OWNER', 'FINANCE']);
const issueInvoiceSchema = z.object({
  orderId: z.string().min(1),
  number: z.string().min(1),
  currency: z.enum(['CZK', 'EUR']),
  amountNet: z.number().positive(),
  vatRatePercent: z.number().min(0).max(100),
  issuedAt: z.string().datetime().optional(),
  dueAt: z.string().datetime().optional(),
});

export const createInvoiceRouter = (invoiceService: InvoiceService) =>
  router({
    list: invoiceReadProcedure.query(async ({ ctx }) => {
      return await invoiceService.list(ctx.auth.tenantId);
    }),
    getById: invoiceReadProcedure
      .input(GetInvoiceByIdSchema)
      .query(async ({ ctx, input }) => {
        const result = await invoiceService.getById(ctx.auth.tenantId, input);
        if (!result) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Invoice access denied',
          });
        }

        return result;
      }),
    issue: invoiceWriteProcedure
      .input(issueInvoiceSchema)
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
    update: invoiceWriteProcedure
      .input(UpdateInvoiceSchema)
      .mutation(async ({ ctx, input }) => {
        try {
          const result = await invoiceService.update(ctx.auth.tenantId, input);
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
    cancel: invoiceWriteProcedure
      .input(CancelInvoiceSchema)
      .mutation(async ({ ctx, input }) => {
        try {
          const result = await invoiceService.cancel(ctx.auth.tenantId, input);
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
