import { z } from 'zod';
export const RentalHistoryQuery = z
    .object({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    year: z.coerce.number().int().min(1900).max(9999).optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
    day: z.coerce.number().int().min(1).max(31).optional(),
    search: z.string().trim().max(160).default(''),
    page: z.coerce.number().int().min(1).max(1000000).default(1),
})
    .refine((q) => !q.from || !q.to || q.from <= q.to, 'Revisa el rango de fechas.');
//# sourceMappingURL=rentalHistory.js.map