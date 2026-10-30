import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lateCharge } from './rentals.js';
const due = new Date('2026-10-30T12:00:00Z');
const at = (minutes, seconds = 0) => new Date(due.getTime() + minutes * 60_000 + seconds * 1000);
test('Sin retraso no hay recargo', () => {
    assert.deepEqual(lateCharge(due, at(-5), 20_000), { minutes: 0, cents: 0 });
    assert.deepEqual(lateCharge(due, due, 20_000), { minutes: 0, cents: 0 });
});
test('El minuto empezado se cobra completo', () => {
    assert.deepEqual(lateCharge(due, at(0, 1), 20_000), { minutes: 1, cents: 20_000 });
    assert.deepEqual(lateCharge(due, at(1), 20_000), { minutes: 1, cents: 20_000 });
    assert.deepEqual(lateCharge(due, at(1, 1), 20_000), { minutes: 2, cents: 40_000 });
});
test('Con recargo en cero se registra el retraso pero no se cobra', () => {
    assert.deepEqual(lateCharge(due, at(17), 0), { minutes: 17, cents: 0 });
});
//# sourceMappingURL=rentals.test.js.map