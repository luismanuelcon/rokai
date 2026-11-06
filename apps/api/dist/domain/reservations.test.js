import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RESERVATION_RULES, colombianHolidays, ratePeriodForDate, reservationWhatsappMessage, scheduleError, startTimesFor, whatsappUrl, } from '@rokai/contracts';
import { newReservationCode, peakUsage, reservationRules } from './reservations.js';
const rules = RESERVATION_RULES;
const at = (iso) => new Date(iso);
// Viernes 6 de noviembre de 2026, 12:00 en Bogotá.
const noon = at('2026-11-06T12:00:00-05:00');
test('horas de inicio: de 4:00 p. m. a 9:00 p. m. sin terminar después de las 10:00 p. m.', () => {
    const half = startTimesFor(rules, 30);
    assert.equal(half[0], '16:00');
    assert.equal(half.at(-1), '21:00');
    assert.equal(half[1], '16:15');
    assert.equal(startTimesFor(rules, 60).at(-1), '21:00');
    assert.equal(startTimesFor(rules, 90).at(-1), '20:30');
});
test('validación de horario: límites, fechas pasadas, horas transcurridas y horizonte', () => {
    assert.equal(scheduleError(rules, '2026-11-06', '16:00', 30, noon), null);
    assert.equal(scheduleError(rules, '2026-11-06', '21:00', 60, noon), null);
    assert.match(scheduleError(rules, '2026-11-06', '15:45', 30, noon) ?? '', /entre las 16:00/);
    assert.match(scheduleError(rules, '2026-11-06', '21:15', 30, noon) ?? '', /entre las 16:00/);
    assert.match(scheduleError(rules, '2026-11-06', '20:45', 90, noon) ?? '', /terminar antes/);
    assert.match(scheduleError(rules, '2026-11-06', '16:10', 30, noon) ?? '', /intervalos/);
    assert.match(scheduleError(rules, '2026-11-05', '17:00', 30, noon) ?? '', /ya pasó/);
    const late = at('2026-11-06T16:10:00-05:00');
    assert.match(scheduleError(rules, '2026-11-06', '16:00', 30, late) ?? '', /ya pasó/);
    assert.equal(scheduleError(rules, '2026-11-06', '16:15', 30, late), null);
    assert.match(scheduleError(rules, '2026-12-08', '17:00', 30, noon) ?? '', /hasta 30 días/);
    assert.match(scheduleError(rules, '2026-11-09', '17:00', 30, noon) ?? '', /no tenemos atención/);
});
test('período tarifario por fecha: semana, fin de semana y festivos de Colombia', () => {
    assert.equal(ratePeriodForDate('2026-11-10'), 'special');
    assert.equal(ratePeriodForDate('2026-11-12'), 'special');
    assert.equal(ratePeriodForDate('2026-11-13'), 'weekend');
    assert.equal(ratePeriodForDate('2026-11-15'), 'weekend');
    assert.equal(ratePeriodForDate('2026-11-09'), null);
    // Lunes festivo (11 de noviembre trasladado) y festivo entre semana.
    assert.equal(ratePeriodForDate('2026-11-16'), 'weekend');
    assert.equal(ratePeriodForDate('2026-12-08'), 'weekend');
    assert.equal(ratePeriodForDate('2026-04-02'), 'weekend');
    const holidays = colombianHolidays(2026);
    assert.equal(holidays.size, 18);
    for (const date of ['2026-01-12', '2026-03-23', '2026-05-18', '2026-06-08', '2026-06-15']) {
        assert.ok(holidays.has(date), date);
    }
});
test('capacidad: pico de uso simultáneo, no suma de solapes', () => {
    const t = (h) => at(`2026-11-13T${h}:00-05:00`);
    const consecutive = [
        { start: t('16:00'), end: t('16:30'), quantity: 1 },
        { start: t('16:30'), end: t('17:00'), quantity: 1 },
    ];
    assert.equal(peakUsage(consecutive, t('16:00'), t('17:00')), 1);
    const overlapping = [...consecutive, { start: t('16:15'), end: t('16:45'), quantity: 2 }];
    assert.equal(peakUsage(overlapping, t('16:00'), t('17:00')), 3);
    assert.equal(peakUsage(consecutive, t('17:00'), t('18:00')), 0);
    assert.equal(peakUsage(consecutive, t('15:00'), t('16:00')), 0);
});
test('reglas configurables y códigos legibles', () => {
    assert.equal(reservationRules({ reservationSlotMinutes: '30' }).slotMinutes, 30);
    assert.equal(reservationRules({ reservationSlotMinutes: '7' }).slotMinutes, 15);
    assert.equal(reservationRules({ reservationMaxDaysAhead: 'x' }).maxDaysAhead, 30);
    const custom = reservationRules({
        reservationOpenTime: '15:00',
        reservationLastStartTime: '20:30',
        reservationCloseTime: '21:30',
    });
    assert.deepEqual([custom.openTime, custom.lastStartTime, custom.closeTime], ['15:00', '20:30', '21:30']);
    assert.equal(startTimesFor(custom, 60).at(-1), '20:30');
    assert.equal(scheduleError(custom, '2026-11-06', '20:45', 30, noon) !== null, true);
    // Horario incoherente: se ignora y rigen los valores por defecto.
    const broken = reservationRules({ reservationOpenTime: '22:00', reservationCloseTime: '21:00' });
    assert.deepEqual([broken.openTime, broken.closeTime], ['16:00', '22:00']);
    const codes = new Set(Array.from({ length: 500 }, newReservationCode));
    assert.equal(codes.size, 500);
    for (const code of codes)
        assert.match(code, /^RK-[2-9A-HJKMNP-Z]{6}$/);
});
test('enlace de WhatsApp: destino de ROKAI y mensaje codificado', () => {
    const message = reservationWhatsappMessage({
        code: 'RK-ABC234',
        customerName: 'Ana María Núñez',
        phone: '+573001112233',
        date: '2026-11-13',
        startTime: '16:00',
        endTime: '16:30',
        quantity: 2,
        planLabel: '30 minutos · 2 patinetas',
        durationMinutes: 30,
        priceCents: 900_000,
    });
    const url = whatsappUrl('+57 310 370 0290', message);
    assert.ok(url.startsWith('https://wa.me/573103700290?text='));
    const text = new URL(url).searchParams.get('text') ?? '';
    assert.equal(text, message);
    assert.ok(!url.includes(' '));
    assert.ok(url.includes('%0A'));
    assert.match(text, /^Hola, ROKAI\. Realicé una reserva desde soyrokai\.com\.\n\nCódigo: RK-ABC234/);
    assert.match(text, /Fecha: viernes, 13 de noviembre de 2026/);
    assert.match(text, /Hora de inicio: 4:00\sp\.\sm\./);
    assert.match(text, /Hora de finalización: 4:30\sp\.\sm\./);
    assert.match(text, /Patinetas: 2\nPlan: 30 minutos · 2 patinetas\nDuración: 30 minutos/);
    assert.match(text, /Valor total: \$\s9\.000/);
    assert.ok(text.endsWith('Quedo atento a sus indicaciones. ¡Gracias!'));
});
//# sourceMappingURL=reservations.test.js.map