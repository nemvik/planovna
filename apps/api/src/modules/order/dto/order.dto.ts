import { z } from 'zod';

export const CreateOrderSchema = z.object({
  tenantId: z.string().min(1),
  customerId: z.string().min(1),
  code: z.string().min(1),
  title: z.string().min(1),
  status: z.string().default('OPEN'),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const UpdateOrderSchema = CreateOrderSchema.partial().extend({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  version: z.number().int().positive(),
});

export const ApplyRoutingTemplateSchema = z.object({
  orderId: z.string().min(1),
  templateId: z.string().min(1),
});

export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderDto = z.infer<typeof UpdateOrderSchema>;
export type ApplyRoutingTemplateDto = z.infer<typeof ApplyRoutingTemplateSchema>;
