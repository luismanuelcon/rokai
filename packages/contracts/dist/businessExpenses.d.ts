import { z } from 'zod';
export declare const ExpenseCategory: z.ZodEnum<{
    maintenance: "maintenance";
    salary: "salary";
    advertising: "advertising";
    parts: "parts";
    transport: "transport";
    services: "services";
    other: "other";
}>;
export declare const CreateBusinessExpense: z.ZodObject<{
    requestId: z.ZodUUID;
    date: z.ZodISODate;
    category: z.ZodEnum<{
        maintenance: "maintenance";
        salary: "salary";
        advertising: "advertising";
        parts: "parts";
        transport: "transport";
        services: "services";
        other: "other";
    }>;
    description: z.ZodString;
    amountCents: z.ZodNumber;
    paymentMethod: z.ZodEnum<{
        cash: "cash";
        transfer: "transfer";
    }>;
    beneficiary: z.ZodDefault<z.ZodString>;
    receiptUrl: z.ZodDefault<z.ZodUnion<[z.ZodURL, z.ZodLiteral<"">]>>;
}, z.core.$strip>;
export declare const UpdateBusinessExpense: z.ZodObject<{
    version: z.ZodNumber;
    date: z.ZodISODate;
    category: z.ZodEnum<{
        maintenance: "maintenance";
        salary: "salary";
        advertising: "advertising";
        parts: "parts";
        transport: "transport";
        services: "services";
        other: "other";
    }>;
    description: z.ZodString;
    amountCents: z.ZodNumber;
    paymentMethod: z.ZodEnum<{
        cash: "cash";
        transfer: "transfer";
    }>;
    beneficiary: z.ZodDefault<z.ZodString>;
    receiptUrl: z.ZodDefault<z.ZodUnion<[z.ZodURL, z.ZodLiteral<"">]>>;
}, z.core.$strip>;
export declare const VoidBusinessExpense: z.ZodObject<{
    version: z.ZodNumber;
    reason: z.ZodString;
}, z.core.$strip>;
export declare const BusinessExpenseQuery: z.ZodObject<{
    from: z.ZodOptional<z.ZodISODate>;
    to: z.ZodOptional<z.ZodISODate>;
    category: z.ZodOptional<z.ZodUnion<[z.ZodEnum<{
        maintenance: "maintenance";
        salary: "salary";
        advertising: "advertising";
        parts: "parts";
        transport: "transport";
        services: "services";
        other: "other";
    }>, z.ZodLiteral<"closing">]>>;
    paymentMethod: z.ZodOptional<z.ZodEnum<{
        cash: "cash";
        transfer: "transfer";
    }>>;
    status: z.ZodDefault<z.ZodEnum<{
        active: "active";
        voided: "voided";
        all: "all";
    }>>;
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
//# sourceMappingURL=businessExpenses.d.ts.map