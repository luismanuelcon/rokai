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