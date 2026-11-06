import { randomInt } from 'node:crypto';
import { RESERVATION_RULES, toMinutes } from '@rokai/contracts';
/**
 * Máximo de patinetas ocupadas a la vez dentro de [start, end). No basta con
 * sumar lo solapado: dos reservas seguidas que tocan el intervalo nunca coinciden.
 */
export function peakUsage(items, start, end) {
    const events = [];
    for (const item of items) {
        if (!(item.start < end && item.end > start))
            continue;
        events.push([Math.max(item.start.getTime(), start.getTime()), item.quantity]);
        events.push([Math.min(item.end.getTime(), end.getTime()), -item.quantity]);
    }
    // A igual instante, las salidas van primero: un intervalo que termina a las 17:00 libera el de las 17:00.
    events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let current = 0;
    let peak = 0;
    for (const [, delta] of events) {
        current += delta;
        peak = Math.max(peak, current);
    }
    return peak;
}
/** Sin 0/O ni 1/I/L: el código se dicta por teléfono. */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export function newReservationCode() {
    let code = '';
    for (let i = 0; i < 6; i++)
        code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    return `RK-${code}`;
}
function intSetting(value, min, max, fallback) {
    const n = Number(value);
    return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}
function timeSetting(value, fallback) {
    return value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
}
/** Reglas efectivas: horario, intervalo y horizonte se ajustan desde Administración. */
export function reservationRules(settings) {
    const slot = intSetting(settings['reservationSlotMinutes'], 5, 60, RESERVATION_RULES.slotMinutes);
    const openTime = timeSetting(settings['reservationOpenTime'], RESERVATION_RULES.openTime);
    const lastStartTime = timeSetting(settings['reservationLastStartTime'], RESERVATION_RULES.lastStartTime);
    const closeTime = timeSetting(settings['reservationCloseTime'], RESERVATION_RULES.closeTime);
    // Un horario incoherente guardado a mano no debe abrir reservas imposibles.
    const coherent = toMinutes(openTime) <= toMinutes(lastStartTime) &&
        toMinutes(lastStartTime) < toMinutes(closeTime);
    return {
        ...RESERVATION_RULES,
        ...(coherent ? { openTime, lastStartTime, closeTime } : {}),
        slotMinutes: 60 % slot === 0 ? slot : RESERVATION_RULES.slotMinutes,
        maxDaysAhead: intSetting(settings['reservationMaxDaysAhead'], 1, 180, RESERVATION_RULES.maxDaysAhead),
    };
}
//# sourceMappingURL=reservations.js.map