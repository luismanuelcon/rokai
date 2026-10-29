import { z } from 'zod';
import { Email, Id, PhoneE164 } from './common.js';
import { Rate } from './catalog.js';
export const Faq = z.object({
    id: Id,
    question: z.string(),
    answer: z.string(),
    position: z.number().int(),
    active: z.boolean(),
});
export const UpsertFaqRequest = z.object({
    question: z.string().trim().min(1).max(200),
    answer: z.string().trim().min(1).max(2000),
    position: z.number().int().min(0).max(999),
    active: z.boolean().default(true),
});
export const PublicSettings = z.object({
    location: z.string().trim().max(300),
    /** Enlace para "Cómo llegar". Solo https, para no abrir esquemas arbitrarios. */
    mapsUrl: z
        .url('El enlace del mapa debe ser una URL válida.')
        .startsWith('https://', 'El enlace del mapa debe usar https.')
        .max(500)
        .or(z.literal('')),
    hours: z.string().trim().max(300),
    whatsapp: PhoneE164.or(z.literal('')),
    instagram: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9._]{1,30}$/, 'Instagram: escribe el usuario sin @ ni enlace.')
        .or(z.literal('')),
    email: Email.or(z.literal('')),
    terms: z.string().max(10_000),
    privacy: z.string().max(10_000),
    cookies: z.string().max(10_000),
});
export const PublicData = z.object({
    rates: z.array(Rate),
    faqs: z.array(Faq),
    settings: PublicSettings,
});
//# sourceMappingURL=public.js.map