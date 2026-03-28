import { z } from 'zod';

export const CreateOperationSchema = z.object({
  tenantId: z.string().min(1),
  orderId: z.string().min(1),
  code: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(['READY', 'IN_PROGRESS', 'DONE', 'BLOCKED']).default('READY'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortIndex: z.number().int().default(0),
  blockedReason: z.string().optional(),
});

export const UpdateOperationSchema = CreateOperationSchema.partial().extend({
  startDate: z.string().datetime().nullable().optional(),
  blockedReason: z.string().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  id: z.string().min(1),
  tenantId: z.string().min(1),
  version: z.number().int().positive(),
});

export const CreateOperationDependencySchema = z.object({
  operationId: z.string().min(1),
  dependsOnId: z.string().min(1),
});

export const RemoveOperationDependencySchema = z.object({
  operationId: z.string().min(1),
  dependsOnId: z.string().min(1),
});

export const BoardColumnConfigItemSchema = z.object({
  key: z.string().min(1),
  name: z.string().trim().min(1),
  order: z.number().int().min(0),
  hidden: z.boolean().default(false),
});

export const SaveBoardColumnConfigSchema = z.object({
  columns: z.array(BoardColumnConfigItemSchema),
});

export type CreateOperationDto = z.infer<typeof CreateOperationSchema>;
export type UpdateOperationDto = z.infer<typeof UpdateOperationSchema>;
export type CreateOperationDependencyDto = z.infer<typeof CreateOperationDependencySchema>;
export type RemoveOperationDependencyDto = z.infer<typeof RemoveOperationDependencySchema>;
export type BoardColumnConfigItemDto = z.infer<typeof BoardColumnConfigItemSchema>;
export type SaveBoardColumnConfigDto = z.infer<typeof SaveBoardColumnConfigSchema>;
