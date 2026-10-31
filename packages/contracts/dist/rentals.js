import { z } from 'zod';
import { Cents, Id, PhoneE164, RequestId } from './common.js';
import { DocumentType, EquipmentKind, PaymentMethod } from './enums.js';
/**
 * El teléfono es opcional mientras el negocio decide si pasa a obligatorio.
 * Sin teléfono no hay notificaciones: ver decisión pendiente en ARQUITECTURA-V2.
 */
export const CustomerInput = z.object({
    fullName: z.string().trim().min(1, 'Nombre: revisa el valor ingresado.').max(120),
    documentType: DocumentType.default('CC'),
    document: z.string().trim().min(1, 'Documento: revisa el valor ingresado.').max(40),
    phone: PhoneE164.nullable().default(null),
});
/**
 * Versión del texto legal que el cliente acepta al firmar. Se guarda con el
 * alquiler y con el consentimiento para poder demostrar *qué* se aceptó.
 * Súbela cada vez que cambie el contenido de `/terminos`.
 */
export const TERMS_VERSION = '2026-10';
/** Firma manuscrita capturada en el lienzo, como PNG en data URL. */
export const SignatureDataUrl = z
    .string()
    .max(250_000, 'La firma ocupa demasiado. Vuelve a firmarla.')
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/, 'Firma: revisa el valor ingresado.');
export const CreateRentalRequest = z.object({
    requestId: RequestId,
    customer: CustomerInput,
    rateId: Id,
    equipmentIds: z
        .array(Id)
        .min(2)
        .max(4)
        .refine((ids) => new Set(ids).size === ids.length, 'No repitas el mismo equipo.'),
    notes: z.string().trim().max(2000).default(''),
    signature: SignatureDataUrl,
    termsAccepted: z
        .boolean()
        .refine((v) => v, 'El cliente debe aceptar los términos y condiciones.'),
});
export const FinishRentalRequest = z.object({
    notes: z.string().trim().max(2000).default(''),
    paymentMethod: PaymentMethod,
});
export const RentalEquipment = z.object({
    code: z.string(),
    kind: EquipmentKind,
});
export const Rental = z.object({
    id: Id,
    customerName: z.string(),
    customerDocumentType: DocumentType,
    customerDocument: z.string(),
    customerPhone: z.string().nullable(),
    minutes: z.number().int(),
    priceCents: Cents,
    finalPriceCents: Cents.nullable(),
    lateMinutes: z.number().int().nullable(),
    lateFeeCents: Cents.nullable(),
    paymentMethod: PaymentMethod.nullable(),
    startedAt: z.iso.datetime(),
    dueAt: z.iso.datetime(),
    endedAt: z.iso.datetime().nullable(),
    createdByName: z.string(),
    endedByName: z.string().nullable(),
    notes: z.string(),
    equipment: z.array(RentalEquipment),
});
export const RentalFilter = z.object({
    status: z.enum(['active', 'finished', 'all']).default('all'),
    search: z.string().trim().max(100).optional(),
});
export const RentalDraft = z.object({
    requestId: RequestId.optional(),
    fullName: z.string().max(120).default(''),
    documentType: DocumentType.default('CC'),
    document: z.string().max(40).default(''),
    phone: z.string().max(20).default(''),
    notes: z.string().max(2000).default(''),
    rateId: Id.nullable().default(null),
    equipmentIds: z.array(Id).max(4).default([]),
});
//# sourceMappingURL=rentals.js.map