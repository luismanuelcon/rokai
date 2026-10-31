import { z } from 'zod';
export declare const Faq: z.ZodObject<{
    id: z.ZodNumber;
    question: z.ZodString;
    answer: z.ZodString;
    position: z.ZodNumber;
    active: z.ZodBoolean;
}, z.core.$strip>;
export type Faq = z.infer<typeof Faq>;
export declare const UpsertFaqRequest: z.ZodObject<{
    question: z.ZodString;
    answer: z.ZodString;
    position: z.ZodNumber;
    active: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type UpsertFaqRequest = z.infer<typeof UpsertFaqRequest>;
export declare const PublicSettings: z.ZodObject<{
    location: z.ZodString;
    mapsUrl: z.ZodUnion<[z.ZodURL, z.ZodLiteral<"">]>;
    hours: z.ZodString;
    whatsapp: z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>;
    instagram: z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>;
    email: z.ZodUnion<[z.ZodEmail, z.ZodLiteral<"">]>;
    lateFeePerMinuteCents: z.ZodString;
    terms: z.ZodString;
    privacy: z.ZodString;
    cookies: z.ZodString;
}, z.core.$strip>;
export type PublicSettings = z.infer<typeof PublicSettings>;
export declare const PublicData: z.ZodObject<{
    rates: z.ZodArray<z.ZodObject<{
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
    }, z.core.$strip>>;
    faqs: z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        question: z.ZodString;
        answer: z.ZodString;
        position: z.ZodNumber;
        active: z.ZodBoolean;
    }, z.core.$strip>>;
    settings: z.ZodObject<{
        location: z.ZodString;
        mapsUrl: z.ZodUnion<[z.ZodURL, z.ZodLiteral<"">]>;
        hours: z.ZodString;
        whatsapp: z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>;
        instagram: z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>;
        email: z.ZodUnion<[z.ZodEmail, z.ZodLiteral<"">]>;
        lateFeePerMinuteCents: z.ZodString;
        terms: z.ZodString;
        privacy: z.ZodString;
        cookies: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export type PublicData = z.infer<typeof PublicData>;
//# sourceMappingURL=public.d.ts.map