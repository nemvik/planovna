import { z } from 'zod';

export const CreateInvoiceSchema = z.object({
  orderId: z.string().min(1),
  number: z.string().min(1),
  currency: z.enum(['CZK', 'EUR']),
  amountNet: z.number().positive(),
  vatRatePercent: z.number().min(0).max(100),
  issuedAt: z.string().datetime().optional(),
  dueAt: z.string().datetime().optional(),
});

export const MarkPaidSchema = z.object({
  invoiceId: z.string().min(1),
  paidAt: z.string().datetime(),
  version: z.number().int().positive(),
  tenantId: z.string().min(1).optional(),
});

export const GetInvoiceByIdSchema = z.object({
  invoiceId: z.string().min(1),
});

export const UpdateInvoiceSchema = z
  .object({
    invoiceId: z.string().min(1),
    version: z.number().int().positive(),
    number: z.string().min(1).optional(),
    issuedAt: z.string().datetime().optional(),
    dueAt: z.string().datetime().optional(),
  })
  .refine(
    (value) => value.number !== undefined || value.issuedAt !== undefined || value.dueAt !== undefined,
    { message: 'At least one editable invoice field must be provided.' },
  );

export const CancelInvoiceSchema = z.object({
  invoiceId: z.string().min(1),
  version: z.number().int().positive(),
});

export type CreateInvoiceDto = z.infer<typeof CreateInvoiceSchema>;
export type GetInvoiceByIdDto = z.infer<typeof GetInvoiceByIdSchema>;
export type MarkPaidDto = z.infer<typeof MarkPaidSchema>;
export type UpdateInvoiceDto = z.infer<typeof UpdateInvoiceSchema>;
export type CancelInvoiceDto = z.infer<typeof CancelInvoiceSchema>;
