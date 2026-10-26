import { z } from 'zod';

export const Id = z.number().int().positive();

/** Dinero siempre en centavos enteros: nunca se opera con punto flotante. */
export const Cents = z.number().int().min(0).max(1_000_000_000);

/** E.164. El cliente de ROKAI es colombiano, pero no se restringe el prefijo. */
export const PhoneE164 = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, 'Teléfono: usa formato internacional, por ejemplo +573106817317.');

export const Email = z.email('Correo electrónico no válido.').max(254).toLowerCase();

/** Fecha simple `YYYY-MM-DD`, usada en la vigencia de tarifas. */
export const IsoDate = z.iso.date();

export const RequestId = z.uuid('Identificador de solicitud no válido.');

export const Pagination = z.object({
  cursor: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(100).default(50),
});
export type Pagination = z.infer<typeof Pagination>;

export const ApiError = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type ApiError = z.infer<typeof ApiError>;

export function pageOf<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}
