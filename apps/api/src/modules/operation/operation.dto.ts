import { z } from 'zod';

export const createOperationSchema = z.object({
  tenantId: z.string().min(1),
  orderId: z.string().min(1),
  code: z.string().min(1),
  title: z.string().min(1),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortIndex: z.number().int().default(0),
});

export const updateOperationSchema = createOperationSchema.partial().extend({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  expectedVersion: z.number().int().positive(),
});

export type CreateOperationDto = z.infer<typeof createOperationSchema>;
export type UpdateOperationDto = z.infer<typeof updateOperationSchema>;
