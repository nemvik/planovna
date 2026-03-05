import { z } from 'zod';

export const createOrderSchema = z.object({
  tenantId: z.string().min(1),
  customerId: z.string().min(1),
  code: z.string().min(1),
  title: z.string().min(1),
  dueDate: z.string().datetime().optional(),
});

export const updateOrderSchema = createOrderSchema.partial().extend({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  expectedVersion: z.number().int().positive(),
});

export type CreateOrderDto = z.infer<typeof createOrderSchema>;
export type UpdateOrderDto = z.infer<typeof updateOrderSchema>;
