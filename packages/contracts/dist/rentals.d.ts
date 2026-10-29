import { z } from 'zod';
/**
 * El teléfono es opcional mientras el negocio decide si pasa a obligatorio.
 * Sin teléfono no hay notificaciones: ver decisión pendiente en ARQUITECTURA-V2.
 */
export declare const CustomerInput: z.ZodObject<{
    fullName: z.ZodString;
    documentType: z.ZodDefault<z.ZodEnum<{
        CC: "CC";
        CE: "CE";
        TI: "TI";
        PA: "PA";
        PEP: "PEP";
        PPT: "PPT";
    }>>;
    document: z.ZodString;
    phone: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type CustomerInput = z.infer<typeof CustomerInput>;
/**
 * Versión del texto legal que el cliente acepta al firmar. Se guarda con el
 * alquiler y con el consentimiento para poder demostrar *qué* se aceptó.
 * Súbela cada vez que cambie el contenido de `/terminos`.
 */
export declare const TERMS_VERSION = "2026-10";
/** Firma manuscrita capturada en el lienzo, como PNG en data URL. */
export declare const SignatureDataUrl: z.ZodString;
export type SignatureDataUrl = z.infer<typeof SignatureDataUrl>;
export declare const CreateRentalRequest: z.ZodObject<{
    requestId: z.ZodUUID;
    customer: z.ZodObject<{
        fullName: z.ZodString;
        documentType: z.ZodDefault<z.ZodEnum<{
            CC: "CC";
            CE: "CE";
            TI: "TI";
            PA: "PA";
            PEP: "PEP";
            PPT: "PPT";
        }>>;
        document: z.ZodString;
        phone: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>;
    rateId: z.ZodNumber;
    equipmentIds: z.ZodArray<z.ZodNumber>;
    notes: z.ZodDefault<z.ZodString>;
    signature: z.ZodString;
    termsAccepted: z.ZodBoolean;
}, z.core.$strip>;
export type CreateRentalRequest = z.infer<typeof CreateRentalRequest>;
export declare const FinishRentalRequest: z.ZodObject<{
    notes: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export type FinishRentalRequest = z.infer<typeof FinishRentalRequest>;
export declare const RentalEquipment: z.ZodObject<{
    code: z.ZodString;
    kind: z.ZodEnum<{
        scooter: "scooter";
        helmet: "helmet";
    }>;
}, z.core.$strip>;
export declare const Rental: z.ZodObject<{
    id: z.ZodNumber;
    customerName: z.ZodString;
    customerDocumentType: z.ZodEnum<{
        CC: "CC";
        CE: "CE";
        TI: "TI";
        PA: "PA";
        PEP: "PEP";
        PPT: "PPT";
    }>;
    customerDocument: z.ZodString;
    customerPhone: z.ZodNullable<z.ZodString>;
    minutes: z.ZodNumber;
    priceCents: z.ZodNumber;
    finalPriceCents: z.ZodNullable<z.ZodNumber>;
    startedAt: z.ZodISODateTime;
    dueAt: z.ZodISODateTime;
    endedAt: z.ZodNullable<z.ZodISODateTime>;
    createdByName: z.ZodString;
    endedByName: z.ZodNullable<z.ZodString>;
    notes: z.ZodString;
    equipment: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        kind: z.ZodEnum<{
            scooter: "scooter";
            helmet: "helmet";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type Rental = z.infer<typeof Rental>;
export declare const RentalFilter: z.ZodObject<{
    status: z.ZodDefault<z.ZodEnum<{
        active: "active";
        finished: "finished";
        all: "all";
    }>>;
    search: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type RentalFilter = z.infer<typeof RentalFilter>;
export declare const RentalDraft: z.ZodObject<{
    requestId: z.ZodOptional<z.ZodUUID>;
    fullName: z.ZodDefault<z.ZodString>;
    documentType: z.ZodDefault<z.ZodEnum<{
        CC: "CC";
        CE: "CE";
        TI: "TI";
        PA: "PA";
        PEP: "PEP";
        PPT: "PPT";
    }>>;
    document: z.ZodDefault<z.ZodString>;
    phone: z.ZodDefault<z.ZodString>;
    notes: z.ZodDefault<z.ZodString>;
    rateId: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    equipmentIds: z.ZodDefault<z.ZodArray<z.ZodNumber>>;
}, z.core.$strip>;
export type RentalDraft = z.infer<typeof RentalDraft>;
//# sourceMappingURL=rentals.d.ts.map