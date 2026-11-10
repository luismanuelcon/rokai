import { z } from 'zod';
import type { RatePeriod } from './enums.js';
export declare const ReservationStatus: z.ZodEnum<{
    pending: "pending";
    confirmed: "confirmed";
    cancelled: "cancelled";
    in_rental: "in_rental";
    completed: "completed";
    no_show: "no_show";
}>;
export type ReservationStatus = z.infer<typeof ReservationStatus>;
export declare const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string>;
/** Estados que ocupan cupo. `in_rental` no: ese cupo ya lo cuenta el alquiler. */
export declare const BLOCKING_RESERVATION_STATUSES: readonly ["pending", "confirmed"];
export interface ReservationRules {
    openTime: string;
    lastStartTime: string;
    closeTime: string;
    slotMinutes: number;
    maxDaysAhead: number;
}
/** Valores por defecto; `settings` puede sobrescribir intervalo y horizonte. */
export declare const RESERVATION_RULES: ReservationRules;
export declare const DEFAULT_RESERVATION_WHATSAPP = "+573103700290";
export declare const BOGOTA_TZ = "America/Bogota";
export declare const TimeOfDay: z.ZodString;
export declare function toMinutes(time: string): number;
export declare function fromMinutes(total: number): string;
/** Instante absoluto de una fecha y hora civiles de Bogotá. */
export declare function bogotaInstant(date: string, time: string): Date;
export declare function bogotaDate(at: Date): string;
export declare function addDays(date: string, days: number): string;
/** Festivos nacionales de Colombia (Ley 51 de 1983, traslado al lunes incluido). */
export declare function colombianHolidays(year: number): Set<string>;
export declare function isColombianHoliday(date: string): boolean;
/**
 * Período tarifario de una fecha, según el catálogo publicado: martes a jueves
 * usa `special`; viernes a domingo y festivos, `weekend`. El lunes no festivo
 * no tiene tarifa publicada, así que devuelve `null`.
 */
export declare function ratePeriodForDate(date: string): RatePeriod | null;
export declare const RATE_PERIOD_LABEL: Record<RatePeriod, string>;
/** Horas de inicio válidas para una duración, sin considerar el reloj ni el cupo. */
export declare function startTimesFor(rules: ReservationRules, durationMinutes: number): string[];
/** Motivo por el que la fecha completa no admite reservas, o `null`. */
export declare function reservationDayError(rules: ReservationRules, date: string, now: Date): string | null;
/** Devuelve el motivo por el que el horario no es reservable, o `null`. */
export declare function scheduleError(rules: ReservationRules, date: string, startTime: string, durationMinutes: number, now: Date): string | null;
export declare const formatReservationDate: (date: string) => string;
export declare const formatReservationTime: (date: string, time: string) => string;
export declare const formatCop: (cents: number) => string;
export interface ReservationSummary {
    code: string;
    customerName: string;
    phone: string;
    date: string;
    startTime: string;
    endTime: string;
    quantity: number;
    planLabel: string;
    durationMinutes: number;
    priceCents: number;
}
export declare function reservationWhatsappMessage(r: ReservationSummary): string;
export declare function whatsappUrl(phoneE164: string, message: string): string;
export declare function planLabel(minutes: number, quantity: number): string;
export declare const ReservationQuantity: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>]>;
export declare const CreateReservationRequest: z.ZodObject<{
    requestId: z.ZodUUID;
    customerName: z.ZodString;
    phone: z.ZodString;
    date: z.ZodISODate;
    startTime: z.ZodString;
    quantity: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>]>;
    rateId: z.ZodNumber;
}, z.core.$strip>;
export type CreateReservationRequest = z.infer<typeof CreateReservationRequest>;
export declare const ReservationAvailabilityQuery: z.ZodObject<{
    date: z.ZodISODate;
    quantity: z.ZodPipe<z.ZodCoercedNumber<unknown>, z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>]>>;
}, z.core.$strip>;
export declare const ReservationSlot: z.ZodObject<{
    start: z.ZodString;
    end: z.ZodString;
    available: z.ZodBoolean;
}, z.core.$strip>;
export declare const ReservationPlan: z.ZodObject<{
    rateId: z.ZodNumber;
    minutes: z.ZodNumber;
    quantity: z.ZodNumber;
    priceCents: z.ZodNumber;
    label: z.ZodString;
    slots: z.ZodArray<z.ZodObject<{
        start: z.ZodString;
        end: z.ZodString;
        available: z.ZodBoolean;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ReservationPlan = z.infer<typeof ReservationPlan>;
/** Lo único que ve el público: cupo agregado, nunca datos de otras reservas. */
export declare const ReservationAvailability: z.ZodObject<{
    date: z.ZodISODate;
    period: z.ZodNullable<z.ZodEnum<{
        special: "special";
        weekend: "weekend";
    }>>;
    periodLabel: z.ZodNullable<z.ZodString>;
    closedReason: z.ZodNullable<z.ZodString>;
    plans: z.ZodArray<z.ZodObject<{
        rateId: z.ZodNumber;
        minutes: z.ZodNumber;
        quantity: z.ZodNumber;
        priceCents: z.ZodNumber;
        label: z.ZodString;
        slots: z.ZodArray<z.ZodObject<{
            start: z.ZodString;
            end: z.ZodString;
            available: z.ZodBoolean;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strict>;
export type ReservationAvailability = z.infer<typeof ReservationAvailability>;
export declare const ReservationOptions: z.ZodObject<{
    today: z.ZodISODate;
    maxDate: z.ZodISODate;
    rules: z.ZodObject<{
        openTime: z.ZodString;
        lastStartTime: z.ZodString;
        closeTime: z.ZodString;
        slotMinutes: z.ZodNumber;
        maxDaysAhead: z.ZodNumber;
    }, z.core.$strip>;
    whatsapp: z.ZodString;
}, z.core.$strict>;
export type ReservationOptions = z.infer<typeof ReservationOptions>;
/** Respuesta del alta pública: solo la reserva recién creada por quien la pidió. */
export declare const PublicReservation: z.ZodObject<{
    code: z.ZodString;
    customerName: z.ZodString;
    phone: z.ZodString;
    date: z.ZodISODate;
    startTime: z.ZodString;
    endTime: z.ZodString;
    quantity: z.ZodNumber;
    planLabel: z.ZodString;
    periodLabel: z.ZodString;
    durationMinutes: z.ZodNumber;
    priceCents: z.ZodNumber;
    status: z.ZodEnum<{
        pending: "pending";
        confirmed: "confirmed";
        cancelled: "cancelled";
        in_rental: "in_rental";
        completed: "completed";
        no_show: "no_show";
    }>;
    whatsappUrl: z.ZodString;
}, z.core.$strict>;
export type PublicReservation = z.infer<typeof PublicReservation>;
export declare const ReservationListQuery: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    date: z.ZodOptional<z.ZodISODate>;
    status: z.ZodOptional<z.ZodEnum<{
        pending: "pending";
        confirmed: "confirmed";
        cancelled: "cancelled";
        in_rental: "in_rental";
        completed: "completed";
        no_show: "no_show";
    }>>;
    sort: z.ZodDefault<z.ZodEnum<{
        start_asc: "start_asc";
        start_desc: "start_desc";
        created_desc: "created_desc";
    }>>;
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export type ReservationListQuery = z.infer<typeof ReservationListQuery>;
/** Confirmar no exige motivo; cancelar y “no asistió” sí. */
export declare const ChangeReservationStatus: z.ZodObject<{
    status: z.ZodEnum<{
        confirmed: "confirmed";
        cancelled: "cancelled";
        no_show: "no_show";
    }>;
    reason: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export type ChangeReservationStatus = z.infer<typeof ChangeReservationStatus>;
//# sourceMappingURL=reservations.d.ts.map