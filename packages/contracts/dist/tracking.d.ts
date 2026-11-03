import { z } from 'zod';
/** Lista cerrada de datos públicos; nunca incluir el objeto alquiler completo. */
export declare const PublicTracking: z.ZodObject<{
    status: z.ZodEnum<{
        active: "active";
        expired: "expired";
        closed: "closed";
    }>;
    serverNow: z.ZodISODateTime;
    startedAt: z.ZodISODateTime;
    preparationEndsAt: z.ZodISODateTime;
    dueAt: z.ZodISODateTime;
    minutes: z.ZodNumber;
    remainingSeconds: z.ZodNumber;
    scooterCount: z.ZodNumber;
    whatsapp: z.ZodString;
}, z.core.$strict>;
export type PublicTracking = z.infer<typeof PublicTracking>;
//# sourceMappingURL=tracking.d.ts.map