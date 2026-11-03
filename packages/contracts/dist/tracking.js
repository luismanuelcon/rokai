import { z } from 'zod';
/** Lista cerrada de datos públicos; nunca incluir el objeto alquiler completo. */
export const PublicTracking = z
    .object({
    status: z.enum(['active', 'expired', 'closed']),
    serverNow: z.iso.datetime(),
    startedAt: z.iso.datetime(),
    preparationEndsAt: z.iso.datetime(),
    dueAt: z.iso.datetime(),
    minutes: z.number().int().positive(),
    remainingSeconds: z.number().int().nonnegative(),
    scooterCount: z.number().int().nonnegative(),
    whatsapp: z.string().regex(/^\d*$/),
})
    .strict();
//# sourceMappingURL=tracking.js.map