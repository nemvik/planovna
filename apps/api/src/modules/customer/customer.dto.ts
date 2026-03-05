import { z } from 'zod';

export const createCustomerSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().min(1),
  ic: z.string().optional(),
  dic: z.string().optional(),
  email: z.email().optional(),
  phone: z.string().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial().extend({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  expectedVersion: z.number().int().positive(),
});

export type CreateCustomerDto = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;
