import { z } from 'zod';
import { Id, IsoDate, PhoneE164, RequestId } from './common.js';
export const ReservationStatus = z.enum([
    'pending',
    'confirmed',
    'cancelled',
    'in_rental',
    'completed',
    'no_show',
]);
export const RESERVATION_STATUS_LABEL = {
    pending: 'Pendiente de WhatsApp',
    confirmed: 'Confirmada',
    cancelled: 'Cancelada',
    in_rental: 'En alquiler',
    completed: 'Completada',
    no_show: 'No asistió',
};
/** Estados que ocupan cupo. `in_rental` no: ese cupo ya lo cuenta el alquiler. */
export const BLOCKING_RESERVATION_STATUSES = ['pending', 'confirmed'];
/** Valores por defecto; `settings` puede sobrescribir intervalo y horizonte. */
export const RESERVATION_RULES = {
    openTime: '16:00',
    lastStartTime: '21:00',
    closeTime: '22:00',
    slotMinutes: 15,
    maxDaysAhead: 30,
};
export const DEFAULT_RESERVATION_WHATSAPP = '+573103700290';
export const BOGOTA_TZ = 'America/Bogota';
/** Colombia no aplica horario de verano: el desfase es fijo. */
const BOGOTA_OFFSET = '-05:00';
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const TimeOfDay = z.string().regex(HHMM, 'Indica una hora válida.');
export function toMinutes(time) {
    const match = HHMM.exec(time);
    if (!match)
        throw new RangeError(`Hora no válida: ${time}`);
    return Number(match[1]) * 60 + Number(match[2]);
}
export function fromMinutes(total) {
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
/** Instante absoluto de una fecha y hora civiles de Bogotá. */
export function bogotaInstant(date, time) {
    return new Date(`${date}T${time}:00${BOGOTA_OFFSET}`);
}
export function bogotaDate(at) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: BOGOTA_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(at);
}
export function addDays(date, days) {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}
function weekday(date) {
    return new Date(`${date}T12:00:00Z`).getUTCDay();
}
function easterSunday(year) {
    // Algoritmo anónimo gregoriano (Meeus/Jones/Butcher).
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return `${String(year)}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function nextMonday(date) {
    const offset = (8 - weekday(date)) % 7;
    return addDays(date, offset);
}
/** Festivos nacionales de Colombia (Ley 51 de 1983, traslado al lunes incluido). */
export function colombianHolidays(year) {
    const y = String(year);
    const fixed = ['01-01', '05-01', '07-20', '08-07', '12-08', '12-25'].map((md) => `${y}-${md}`);
    const moved = ['01-06', '03-19', '06-29', '08-15', '10-12', '11-01', '11-11'].map((md) => nextMonday(`${y}-${md}`));
    const easter = easterSunday(year);
    const easterBased = [
        addDays(easter, -3),
        addDays(easter, -2),
        addDays(easter, 43),
        addDays(easter, 64),
        addDays(easter, 71),
    ];
    return new Set([...fixed, ...moved, ...easterBased]);
}
export function isColombianHoliday(date) {
    return colombianHolidays(Number(date.slice(0, 4))).has(date);
}
/**
 * Período tarifario de una fecha, según el catálogo publicado: martes a jueves
 * usa `special`; viernes a domingo y festivos, `weekend`. El lunes no festivo
 * no tiene tarifa publicada, así que devuelve `null`.
 */
export function ratePeriodForDate(date) {
    if (isColombianHoliday(date))
        return 'weekend';
    const day = weekday(date);
    if (day === 0 || day === 5 || day === 6)
        return 'weekend';
    if (day >= 2 && day <= 4)
        return 'special';
    return null;
}
export const RATE_PERIOD_LABEL = {
    special: 'Martes a jueves',
    weekend: 'Viernes a domingo y festivos',
};
/** Horas de inicio válidas para una duración, sin considerar el reloj ni el cupo. */
export function startTimesFor(rules, durationMinutes) {
    const first = toMinutes(rules.openTime);
    const last = Math.min(toMinutes(rules.lastStartTime), toMinutes(rules.closeTime) - durationMinutes);
    const times = [];
    for (let t = first; t <= last; t += rules.slotMinutes)
        times.push(fromMinutes(t));
    return times;
}
/** Motivo por el que la fecha completa no admite reservas, o `null`. */
export function reservationDayError(rules, date, now) {
    const today = bogotaDate(now);
    if (date < today)
        return 'La fecha ya pasó. Elige hoy o una fecha futura.';
    if (date > addDays(today, rules.maxDaysAhead))
        return `Solo recibimos reservas hasta ${String(rules.maxDaysAhead)} días antes.`;
    if (!ratePeriodForDate(date))
        return 'Ese día no tenemos atención. Elige otra fecha.';
    return null;
}
/** Devuelve el motivo por el que el horario no es reservable, o `null`. */
export function scheduleError(rules, date, startTime, durationMinutes, now) {
    const dayError = reservationDayError(rules, date, now);
    if (dayError)
        return dayError;
    const start = toMinutes(startTime);
    if (start < toMinutes(rules.openTime) || start > toMinutes(rules.lastStartTime))
        return `La hora de inicio debe estar entre las ${rules.openTime} y las ${rules.lastStartTime}.`;
    if ((start - toMinutes(rules.openTime)) % rules.slotMinutes !== 0)
        return `Elige una hora en intervalos de ${String(rules.slotMinutes)} minutos.`;
    if (start + durationMinutes > toMinutes(rules.closeTime))
        return `El plan debe terminar antes de las ${rules.closeTime}. Elige una hora más temprana o un plan más corto.`;
    if (bogotaInstant(date, startTime).getTime() <= now.getTime())
        return 'Esa hora ya pasó. Elige una hora posterior.';
    return null;
}
/* ------------------------------------------------------------- formato */
const DATE_LONG = new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
});
const TIME_SHORT = new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
});
const COP = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});
export const formatReservationDate = (date) => DATE_LONG.format(bogotaInstant(date, '12:00'));
export const formatReservationTime = (date, time) => TIME_SHORT.format(bogotaInstant(date, time));
export const formatCop = (cents) => COP.format(cents / 100);
export function reservationWhatsappMessage(r) {
    return [
        'Hola, ROKAI. Realicé una reserva desde soyrokai.com.',
        '',
        `Código: ${r.code}`,
        `Nombre: ${r.customerName}`,
        `WhatsApp: ${r.phone}`,
        `Fecha: ${formatReservationDate(r.date)}`,
        `Hora de inicio: ${formatReservationTime(r.date, r.startTime)}`,
        `Hora de finalización: ${formatReservationTime(r.date, r.endTime)}`,
        `Patinetas: ${String(r.quantity)}`,
        `Plan: ${r.planLabel}`,
        `Duración: ${String(r.durationMinutes)} minutos`,
        `Valor total: ${formatCop(r.priceCents)}`,
        '',
        'Quedo atento a sus indicaciones. ¡Gracias!',
    ].join('\n');
}
export function whatsappUrl(phoneE164, message) {
    return `https://wa.me/${phoneE164.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}
export function planLabel(minutes, quantity) {
    const time = minutes === 60 ? '1 hora' : `${String(minutes)} minutos`;
    return `${time} · ${quantity === 1 ? '1 patineta' : `${String(quantity)} patinetas`}`;
}
/* ---------------------------------------------------------------- DTOs */
export const ReservationQuantity = z.union([z.literal(1), z.literal(2)]);
export const CreateReservationRequest = z.object({
    requestId: RequestId,
    customerName: z.string().trim().min(2, 'Escribe tu nombre.').max(120),
    phone: PhoneE164,
    date: IsoDate,
    startTime: TimeOfDay,
    quantity: ReservationQuantity,
    rateId: Id,
});
export const ReservationAvailabilityQuery = z.object({
    date: IsoDate,
    quantity: z.coerce.number().pipe(ReservationQuantity),
});
export const ReservationSlot = z.object({
    start: TimeOfDay,
    end: TimeOfDay,
    available: z.boolean(),
});
export const ReservationPlan = z.object({
    rateId: Id,
    minutes: z.number().int().positive(),
    quantity: z.number().int(),
    priceCents: z.number().int().nonnegative(),
    label: z.string(),
    slots: z.array(ReservationSlot),
});
/** Lo único que ve el público: cupo agregado, nunca datos de otras reservas. */
export const ReservationAvailability = z
    .object({
    date: IsoDate,
    period: z.enum(['special', 'weekend']).nullable(),
    periodLabel: z.string().nullable(),
    closedReason: z.string().nullable(),
    plans: z.array(ReservationPlan),
})
    .strict();
export const ReservationOptions = z
    .object({
    today: IsoDate,
    maxDate: IsoDate,
    rules: z.object({
        openTime: TimeOfDay,
        lastStartTime: TimeOfDay,
        closeTime: TimeOfDay,
        slotMinutes: z.number().int().positive(),
        maxDaysAhead: z.number().int().positive(),
    }),
    whatsapp: z.string(),
})
    .strict();
/** Respuesta del alta pública: solo la reserva recién creada por quien la pidió. */
export const PublicReservation = z
    .object({
    code: z.string(),
    customerName: z.string(),
    phone: z.string(),
    date: IsoDate,
    startTime: TimeOfDay,
    endTime: TimeOfDay,
    quantity: z.number().int(),
    planLabel: z.string(),
    periodLabel: z.string(),
    durationMinutes: z.number().int(),
    priceCents: z.number().int(),
    status: ReservationStatus,
    whatsappUrl: z.string(),
})
    .strict();
export const ReservationListQuery = z.object({
    search: z.string().trim().max(100).optional(),
    date: IsoDate.optional(),
    status: ReservationStatus.optional(),
    sort: z.enum(['start_asc', 'start_desc', 'created_desc']).default('start_asc'),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
});
/** Confirmar no exige motivo; cancelar y “no asistió” sí. */
export const ChangeReservationStatus = z
    .object({
    status: z.enum(['confirmed', 'cancelled', 'no_show']),
    reason: z.string().trim().max(500, 'El motivo admite hasta 500 caracteres.').default(''),
})
    .refine((v) => v.status === 'confirmed' || v.reason.length >= 5, {
    message: 'Explica el motivo con al menos 5 caracteres.',
    path: ['reason'],
});
//# sourceMappingURL=reservations.js.map