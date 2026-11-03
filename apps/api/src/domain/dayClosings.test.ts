import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CreateDayClosingRequest, UpdateDayClosingRequest } from '@rokai/contracts';

const input = {
  date: '2020-02-29',
  opensAt: '08:00',
  closesAt: '22:00',
  closesNextDay: false,
  cashCents: 10000,
  transferCents: 5000,
  expenses: [{ description: 'Transporte', amountCents: 2000 }],
  notes: '',
};
test('cierre admite fechas anteriores sin vigencia y días con ingresos cero', () => {
  assert.equal(CreateDayClosingRequest.safeParse(input).success, true);
  assert.equal(
    CreateDayClosingRequest.safeParse({ ...input, cashCents: 0, transferCents: 0, expenses: [] })
      .success,
    true,
  );
});
test('cierre valida fecha real, horario y cruce de medianoche', () => {
  for (const patch of [
    { date: '2025-02-29' },
    { opensAt: '24:00' },
    { closesAt: '07:00' },
    { closesAt: '08:00' },
  ]) {
    assert.equal(CreateDayClosingRequest.safeParse({ ...input, ...patch }).success, false);
  }
  assert.equal(
    CreateDayClosingRequest.safeParse({
      ...input,
      opensAt: '18:00',
      closesAt: '01:00',
      closesNextDay: true,
    }).success,
    true,
  );
});
test('cierre rechaza importes negativos, fracciones, gastos sin descripción y edición sin versión', () => {
  for (const patch of [
    { cashCents: -1 },
    { transferCents: 1.1 },
    { expenses: [{ description: ' ', amountCents: 1 }] },
    { expenses: [{ description: 'Gasto', amountCents: 0 }] },
  ]) {
    assert.equal(CreateDayClosingRequest.safeParse({ ...input, ...patch }).success, false);
  }
  assert.equal(UpdateDayClosingRequest.safeParse(input).success, false);
  assert.equal(UpdateDayClosingRequest.safeParse({ ...input, version: 1 }).success, true);
});
