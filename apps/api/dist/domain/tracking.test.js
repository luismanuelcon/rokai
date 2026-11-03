import { PublicSettings } from '@rokai/contracts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newTrackingToken, validTrackingToken, trackingClock, redactTrackingUrl, } from './tracking.js';
test('tokens de 256 bits, URL seguros y únicos', () => {
    const tokens = new Set(Array.from({ length: 1000 }, newTrackingToken));
    assert.equal(tokens.size, 1000);
    for (const token of tokens)
        assert.ok(validTrackingToken(token));
    for (const token of ['', '1', 'a'.repeat(42), '../token', 'a'.repeat(44)])
        assert.equal(validTrackingToken(token), false);
});
test('reloj autoritativo, ampliación y cierre sin tiempos negativos', () => {
    const now = new Date('2026-11-03T20:00:00Z');
    assert.deepEqual(trackingClock(new Date(+now + 60000), null, now), {
        status: 'active',
        remainingSeconds: 60,
    });
    assert.deepEqual(trackingClock(new Date(+now + 120000), null, now), {
        status: 'active',
        remainingSeconds: 120,
    });
    assert.deepEqual(trackingClock(now, null, now), { status: 'expired', remainingSeconds: 0 });
    assert.deepEqual(trackingClock(new Date(+now - 10000), null, now), {
        status: 'expired',
        remainingSeconds: 0,
    });
    assert.deepEqual(trackingClock(new Date(+now + 60000), now, now), {
        status: 'closed',
        remainingSeconds: 0,
    });
});
test('logs ocultan token público y query string', () => {
    const token = newTrackingToken();
    for (const base of ['/api/v1/tracking/', '/alquiler/seguimiento/']) {
        const url = redactTrackingUrl(base + token + '?token=' + token);
        assert.equal(url, base + '[REDACTED]');
        assert.ok(!url.includes(token));
    }
});
test('preparación: un minuto por defecto, cero desactiva y límites enteros', () => {
    const setting = PublicSettings.shape.preparationMinutes;
    assert.equal(setting.parse(undefined), '1');
    for (const value of ['0', '1', '3', '30'])
        assert.equal(setting.parse(value), value);
    for (const value of ['', '-1', '1.5', '31', 'abc'])
        assert.equal(setting.safeParse(value).success, false);
});
//# sourceMappingURL=tracking.test.js.map