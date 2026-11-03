import { z } from 'zod';
export declare const ClosingDate: z.ZodISODate;
export declare const CreateDayClosingRequest: z.ZodObject<{
    date: z.ZodISODate;
    opensAt: z.ZodString;
    closesAt: z.ZodString;
    closesNextDay: z.ZodDefault<z.ZodBoolean>;
    cashCents: z.ZodNumber;
    transferCents: z.ZodNumber;
    expenses: z.ZodArray<z.ZodObject<{
        description: z.ZodString;
        amountCents: z.ZodNumber;
    }, z.core.$strip>>;
    notes: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export declare const UpdateDayClosingRequest: z.ZodObject<{
    version: z.ZodNumber;
    date: z.ZodISODate;
    opensAt: z.ZodString;
    closesAt: z.ZodString;
    closesNextDay: z.ZodDefault<z.ZodBoolean>;
    cashCents: z.ZodNumber;
    transferCents: z.ZodNumber;
    expenses: z.ZodArray<z.ZodObject<{
        description: z.ZodString;
        amountCents: z.ZodNumber;
    }, z.core.$strip>>;
    notes: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export type DayClosingInput = z.infer<typeof CreateDayClosingRequest>;
export interface DayClosing extends DayClosingInput {
    id: number;
    version: number;
    createdAt: string;
    updatedAt: string;
    createdBy: number | null;
    updatedBy: number | null;
}
//# sourceMappingURL=dayClosings.d.ts.map