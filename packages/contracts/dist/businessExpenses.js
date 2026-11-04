import { z } from 'zod';
import { ClosingDate } from './dayClosings.js';
export const ExpenseCategory = z.enum([
    'salary',
    'advertising',
    'parts',
    'maintenance',
    'transport',
    'services',
    'other',
]);
const fields = {
    date: ClosingDate,
    category: ExpenseCategory,
    description: z.string().trim().min(3, 'Describe el gasto.').max(160),
    amountCents: z.number().int().positive().max(1_000_000_000).multipleOf(100),
    paymentMethod: z.enum(['cash', 'transfer']),
    beneficiary: z.string().trim().max(160).default(''),
    receiptUrl: z.url().startsWith('https://').max(1000).or(z.literal('')).default(''),
};
export const CreateBusinessExpense = z.object({ ...fields, requestId: z.uuid() });
export const UpdateBusinessExpense = z.object({ ...fields, version: z.number().int().positive() });
export const VoidBusinessExpense = z.object({
    version: z.number().int().positive(),
    reason: z.string().trim().min(10).max(1000),
});
export const BusinessExpenseQuery = z
    .object({
    from: ClosingDate.optional(),
    to: ClosingDate.optional(),
    category: ExpenseCategory.or(z.literal('closing')).optional(),
    paymentMethod: z.enum(['cash', 'transfer']).optional(),
    status: z.enum(['active', 'voided', 'all']).default('active'),
    page: z.coerce.number().int().min(1).max(1000000).default(1),
})
    .refine((v) => !v.from || !v.to || v.from <= v.to, 'La fecha inicial debe ser anterior a la final.');
//# sourceMappingURL=businessExpenses.js.map