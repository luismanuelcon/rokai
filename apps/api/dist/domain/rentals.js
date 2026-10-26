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