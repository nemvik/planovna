import { z } from 'zod';

export const CreateCustomerSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().min(1),
  ic: z.string().optional(),
  dic: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export const UpdateCustomerSchema = CreateCustomerSchema.partial().extend({
  id: z.string().min(1),
  version: z.number().int().positive(),
  tenantId: z.string().min(1),
});

export type CreateCustomerDto = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerDto = z.infer<typeof UpdateCustomerSchema>;
