import { z } from 'zod';

export const CreateInvoiceSchema = z.object({
  tenantId: z.string().min(1),
  orderId: z.string().min(1),
  number: z.string().min(1),
  currency: z.enum(['CZK', 'EUR']),
  amountGross: z.number().positive(),
  issuedAt: z.string().datetime().optional(),
  dueAt: z.string().datetime().optional(),
});

export const MarkPaidSchema = z.object({
  invoiceId: z.string().min(1),
  paidAt: z.string().datetime(),
  version: z.number().int().positive(),
  tenantId: z.string().min(1).optional(),
});

export type CreateInvoiceDto = z.infer<typeof CreateInvoiceSchema>;
export type MarkPaidDto = z.infer<typeof MarkPaidSchema>;
