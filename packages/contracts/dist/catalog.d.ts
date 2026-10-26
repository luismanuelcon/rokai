import { z } from 'zod';
export declare const Rate: z.ZodObject<{
    id: z.ZodNumber;
    period: z.ZodEnum<{
        special: "special";
        weekend: "weekend";
    }>;
    minutes: z.ZodNumber;
    quantity: z.ZodNumber;
    priceCents: z.ZodNumber;
    active: z.ZodBoolean;
    validFrom: z.ZodNullable<z.ZodISODate>;
    validUntil: z.ZodNullable<z.ZodISODate>;
}, z.core.$strip>;
export type Rate = z.infer<typeof Rate>;
export declare const CreateRateRequest: z.ZodObject<{
    period: z.ZodEnum<{
        special: "special";
        weekend: "weekend";
    }>;
    minutes: z.ZodNumber;
    quantity: z.ZodNumber;
    priceCents: z.ZodNumber;
    validFrom: z.ZodDefault<z.ZodNullable<z.ZodISODate>>;
    validUntil: z.ZodDefault<z.ZodNullable<z.ZodISODate>>;
}, z.core.$strip>;
export type CreateRateRequest = z.infer<typeof CreateRateRequest>;
export declare const UpdateRateRequest: z.ZodObject<{
    priceCents: z.ZodNumber;
    active: z.ZodBoolean;
    validFrom: z.ZodDefault<z.ZodNullable<z.ZodISODate>>;
    validUntil: z.ZodDefault<z.ZodNullable<z.ZodISODate>>;
}, z.core.$strip>;
export type UpdateRateRequest = z.infer<typeof UpdateRateRequest>;
export declare const Equipment: z.ZodObject<{
    id: z.ZodNumber;
    code: z.ZodString;
    kind: z.ZodEnum<{
        scooter: "scooter";
        helmet: "helmet";
    }>;
    status: z.ZodEnum<{
        available: "available";
        maintenance: "maintenance";
        inactive: "inactive";
    }>;
    busy: z.ZodBoolean;
}, z.core.$strip>;
export type Equipment = z.infer<typeof Equipment>;
export declare const CreateEquipmentRequest: z.ZodObject<{
    code: z.ZodString;
    kind: z.ZodEnum<{
        scooter: "scooter";
        helmet: "helmet";
    }>;
}, z.core.$strip>;
export type CreateEquipmentRequest = z.infer<typeof CreateEquipmentRequest>;
export declare const UpdateEquipmentRequest: z.ZodObject<{
    status: z.ZodEnum<{
        available: "available";
        maintenance: "maintenance";
        inactive: "inactive";
    }>;
}, z.core.$strip>;
export type UpdateEquipmentRequest = z.infer<typeof UpdateEquipmentRequest>;
//# sourceMappingURL=catalog.d.ts.map