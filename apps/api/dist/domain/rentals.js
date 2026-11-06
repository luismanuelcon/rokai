import { conflict, badRequest } from '../lib/http-error.js';
/**
 * Regla de negocio pura: una patineta y un casco por persona, todo disponible.
 * Sin IO, por lo que se puede probar unitariamente.
 */
export function assertAssignable(selected, requestedIds, quantity) {
    if (requestedIds.length !== quantity * 2) {
        throw badRequest('Asigna una patineta y un casco por persona.');
    }
    if (new Set(requestedIds).size !== requestedIds.length) {
        throw badRequest('No repitas el mismo equipo.');
    }
    if (selected.length !== requestedIds.length) {
        throw conflict('Algún equipo ya no está disponible. Revisa la selección.');
    }
    if (selected.some((e) => e.busy || e.status !== 'available')) {
        throw conflict('Algún equipo ya no está disponible. Revisa la selección.');
    }
    const scooters = selected.filter((e) => e.kind === 'scooter').length;
    const helmets = selected.filter((e) => e.kind === 'helmet').length;
    if (scooters !== quantity || helmets !== quantity) {
        throw badRequest('Asigna una patineta y un casco por persona.');
    }
}
/**
 * Recargo por devolución tardía. Se cobra por minuto empezado: devolver a los
 * 61 segundos de vencido cuesta dos minutos, no uno. Regla pura y sin IO.
 * Los minutos de retraso se registran aunque el recargo configurado sea cero.
 */
export function lateCharge(dueAt, endedAt, perMinuteCents) {
    const overdueMs = endedAt.getTime() - dueAt.getTime();
    if (overdueMs <= 0)
        return { minutes: 0, cents: 0 };
    const minutes = Math.ceil(overdueMs / 60_000);
    return { minutes, cents: perMinuteCents > 0 ? minutes * perMinuteCents : 0 };
}
/** Calcula el recargo comparando solo la hora civil de Bogotá, sin fecha. */
export function lateChargeAtTime(dueAt, returnTime, perMinuteCents) {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(returnTime);
    if (!match)
        throw new RangeError('La hora de devolución no es válida.');
    const dueTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Bogota',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).format(dueAt);
    const [dueHour, dueMinute] = dueTime.split(':').map(Number);
    const returnMinutes = Number(match[1]) * 60 + Number(match[2]);
    const dueMinutes = dueHour * 60 + dueMinute;
    const minutes = Math.max(0, returnMinutes - dueMinutes);
    return { minutes, cents: perMinuteCents > 0 ? minutes * perMinuteCents : 0 };
}
/** Una tarifa está vigente si está activa y la fecha civil cae dentro del rango. */
export function isRateCurrent(rate, today) {
    if (!rate.active)
        return false;
    if (rate.validFrom && rate.validFrom > today)
        return false;
    if (rate.validUntil && rate.validUntil < today)
        return false;
    return true;
}
//# sourceMappingURL=rentals.js.map