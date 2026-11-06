import { z } from 'zod';
export declare const RentalHistoryQuery: z.ZodObject<{
    from: z.ZodOptional<z.ZodISODate>;
    to: z.ZodOptional<z.ZodISODate>;
    year: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    month: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    day: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    search: z.ZodDefault<z.ZodString>;
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export type RentalHistoryQuery = z.infer<typeof RentalHistoryQuery>;
//# sourceMappingURL=rentalHistory.d.ts.map