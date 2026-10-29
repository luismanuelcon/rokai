import { z } from 'zod';
export declare const Id: z.ZodNumber;
/** Dinero siempre en centavos enteros: nunca se opera con punto flotante. */
export declare const Cents: z.ZodNumber;
/** E.164. El cliente de ROKAI es colombiano, pero no se restringe el prefijo. */
export declare const PhoneE164: z.ZodString;
export declare const Email: z.ZodEmail;
/** Fecha simple `YYYY-MM-DD`, usada en la vigencia de tarifas. */
export declare const IsoDate: z.ZodISODate;
export declare const RequestId: z.ZodUUID;
export declare const Pagination: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type Pagination = z.infer<typeof Pagination>;
export declare const ApiError: z.ZodObject<{
    error: z.ZodString;
    code: z.ZodOptional<z.ZodString>;
    details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type ApiError = z.infer<typeof ApiError>;
export declare function pageOf<T extends z.ZodTypeAny>(item: T): z.ZodObject<{
    items: z.ZodArray<T>;
    nextCursor: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
//# sourceMappingURL=common.d.ts.map