import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  quoteGroupRate,
  ReservationQuantity,
  CreateRentalRequest,
  RentalDraft,
  planLabel,
  reservationWhatsappMessage,
} from '@rokai/contracts';
import { assertAssignable } from './rentals.js';

const catalog = [30, 60, 90].flatMap((minutes, i) =>
  ['special', 'weekend'].flatMap((period, j) => [
    {
      id: i * 4 + j * 2 + 1,
      minutes,
      period,
      quantity: 1,
      priceCents: 1500000 + i * 100000 + j * 50000,
    },
    {
      id: i * 4 + j * 2 + 2,
      minutes,
      period,
      quantity: 2,
      priceCents: 2200000 + i * 200000 + j * 80000,
    },
  ]),
);

test('grupos 1–4: conserva individual/pareja y combina por duración y categoría', () => {
  for (const pair of catalog.filter((r) => r.quantity === 2)) {
    const single = catalog.find((r) => r.id === pair.id - 1)!;
    for (const quantity of [1, 2, 3, 4]) {
      const quote = quoteGroupRate(catalog, quantity === 1 ? single.id : pair.id, quantity)!;
      assert.equal(
        quote.priceCents,
        Math.floor(quantity / 2) * pair.priceCents + (quantity % 2) * single.priceCents,
      );
      assert.equal(quote.quantity, quantity);
      assert.equal(quote.minutes, pair.minutes);
      assert.equal(quote.period, pair.period);
    }
  }
});

test('no inventa tarifas ni mezcla categorías o duraciones', () => {
  const missing = catalog.filter((r) => r.id !== 1);
  assert.equal(quoteGroupRate(missing, 2, 3), null);
  assert.equal(quoteGroupRate(missing, 2, 4)?.priceCents, catalog[1]!.priceCents * 2);
  assert.equal(quoteGroupRate(catalog, 1, 3), null);
  assert.equal(quoteGroupRate(catalog, 999, 4), null);
});

test('cantidades inválidas se rechazan y borradores admiten ocho equipos', () => {
  for (const quantity of [0, -1, 5, 1.5, NaN, Infinity, '3', null]) {
    assert.equal(ReservationQuantity.safeParse(quantity).success, false);
    if (typeof quantity === 'number') assert.equal(quoteGroupRate(catalog, 2, quantity), null);
  }
  assert.equal(
    RentalDraft.parse({ quantity: 4, equipmentIds: [1, 2, 3, 4, 5, 6, 7, 8] }).quantity,
    4,
  );
  assert.equal(
    CreateRentalRequest.shape.equipmentIds.safeParse([1, 2, 3, 4, 5, 6, 7, 8]).success,
    true,
  );
  assert.equal(CreateRentalRequest.shape.equipmentIds.safeParse([1, 1, 3, 4]).success, false);
});

test('asignación 1–4 exige una patineta y un casco distintos y libres por persona', () => {
  for (const quantity of [1, 2, 3, 4]) {
    const equipment = Array.from({ length: quantity * 2 }, (_, i) => ({
      id: i + 1,
      kind: i < quantity ? ('scooter' as const) : ('helmet' as const),
      status: 'available' as const,
      busy: false,
    }));
    const ids = equipment.map((e) => e.id);
    assert.doesNotThrow(() => assertAssignable(equipment, ids, quantity));
    assert.throws(() =>
      assertAssignable(
        equipment.map((e, i) => ({ ...e, busy: i === 0 })),
        ids,
        quantity,
      ),
    );
    assert.throws(() => assertAssignable(equipment.slice(1), ids.slice(1), quantity));
  }
});

test('WhatsApp incluye grupo, desglose e importe del snapshot', () => {
  for (const quantity of [3, 4]) {
    const message = reservationWhatsappMessage({
      code: 'RK-ABC234',
      customerName: 'Grupo',
      phone: '+573001234567',
      date: '2026-11-13',
      startTime: '16:00',
      endTime: '17:00',
      quantity,
      planLabel: planLabel(60, quantity),
      durationMinutes: 60,
      priceCents: 3700000,
    });
    assert.match(message, new RegExp(`Patinetas: ${quantity}`));
    assert.ok(
      message.includes(quantity === 3 ? '1 plan de pareja + 1 individual' : '2 planes de pareja'),
    );
    assert.match(message, /37.000/);
  }
});
