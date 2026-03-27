import { z } from 'zod';

export const CreateRecurringCashflowRuleSchema = z.object({
  label: z.string().min(1),
  amount: z.number().positive(),
  currency: z.enum(['CZK', 'EUR']),
  interval: z.enum(['MONTHLY']),
  startDate: z.string().datetime(),
  note: z.string().optional(),
});

export const UpdateRecurringCashflowRuleSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  label: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  currency: z.enum(['CZK', 'EUR']).optional(),
  startDate: z.string().datetime().optional(),
  note: z.string().optional(),
});

export const RecurringCashflowRuleActionSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
});

export type CreateRecurringCashflowRuleDto = z.infer<typeof CreateRecurringCashflowRuleSchema>;
export type UpdateRecurringCashflowRuleDto = z.infer<typeof UpdateRecurringCashflowRuleSchema>;
export type RecurringCashflowRuleActionDto = z.infer<typeof RecurringCashflowRuleActionSchema>;
