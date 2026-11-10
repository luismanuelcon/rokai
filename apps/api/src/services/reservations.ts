import { and, eq, gt, inArray, isNull, lt, sql } from 'drizzle-orm';
import { equipment, rates, rentalEquipment, rentals, reservations, settings } from '@rokai/db';
import {
  BLOCKING_RESERVATION_STATUSES,
  DEFAULT_RESERVATION_WHATSAPP,
  RATE_PERIOD_LABEL,
  addDays,
  bogotaDate,
  bogotaInstant,
  fromMinutes,
  planLabel,
  quoteGroupRate,
  ratePeriodForDate,
  reservationDayError,
  reservationWhatsappMessage,
  scheduleError,
  startTimesFor,
  toMinutes,
  whatsappUrl,
  type CreateReservationRequest,
  type PublicReservation,
  type ReservationAvailability,
  type ReservationOptions,
  type ReservationRules,
} from '@rokai/contracts';
import type { Db, Executor } from '../db.js';
import {
  newReservationCode,
  peakUsage,
  reservationRules,
  type Occupancy,
} from '../domain/reservations.js';
import { badRequest, conflict } from '../lib/http-error.js';
import { recordAudit } from '../lib/audit.js';
import { activeRates } from '../repositories/catalog.js';

type ReservationRow = typeof reservations.$inferSelect;

async function settingsMap(exec: Executor): Promise<Record<string, string>> {
  const rows = await exec.select().from(settings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

function contactNumber(config: Record<string, string>): string {
  const value = config['reservationWhatsapp'] ?? '';
  return /^\+[1-9]\d{7,14}$/.test(value) ? value : DEFAULT_RESERVATION_WHATSAPP;
}

/** Cada persona sale con patineta y casco: la flota útil es el menor de los dos. */
export async function fleetCapacity(exec: Executor): Promise<number> {
  const rows = await exec
    .select({ kind: equipment.kind, total: sql<number>`count(*)`.mapWith(Number) })
    .from(equipment)
    .where(eq(equipment.status, 'available'))
    .groupBy(equipment.kind);
  const count = (kind: string) => rows.find((r) => r.kind === kind)?.total ?? 0;
  return Math.min(count('scooter'), count('helmet'));
}

/** Reservas que bloquean cupo y alquileres en curso que tocan el intervalo. */
export async function occupancy(
  exec: Executor,
  from: Date,
  to: Date,
  excludeReservationId?: number,
): Promise<Occupancy[]> {
  const booked = await exec
    .select({
      start: reservations.startsAt,
      end: reservations.endsAt,
      quantity: reservations.quantity,
    })
    .from(reservations)
    .where(
      and(
        inArray(reservations.status, [...BLOCKING_RESERVATION_STATUSES]),
        excludeReservationId === undefined
          ? undefined
          : sql`${reservations.id} <> ${excludeReservationId}`,
        lt(reservations.startsAt, to),
        gt(reservations.endsAt, from),
      ),
    );
  // Un alquiler vencido sigue ocupando el equipo hasta que se devuelve.
  const rented = await exec
    .select({
      start: rentals.startedAt,
      end: sql<Date>`greatest(${rentals.dueAt}, now())`.mapWith((v: string | Date) => new Date(v)),
      quantity: sql<number>`(
        select count(*) from ${rentalEquipment} re join ${equipment} e on e.id = re.equipment_id
        where re.rental_id = "rentals"."id" and e.kind = 'scooter'
      )`.mapWith(Number),
    })
    .from(rentals)
    .where(
      and(
        isNull(rentals.endedAt),
        lt(rentals.startedAt, to),
        sql`greatest(${rentals.dueAt}, now()) > ${from}`,
      ),
    );
  return [...booked, ...rented];
}

export async function reservationOptions(db: Db, now = new Date()): Promise<ReservationOptions> {
  const config = await settingsMap(db);
  const rules = reservationRules(config);
  const today = bogotaDate(now);
  return {
    today,
    maxDate: addDays(today, rules.maxDaysAhead),
    rules,
    whatsapp: contactNumber(config),
  };
}

/** Planes del catálogo vigente en esa fecha, para su período y cantidad. */
async function plansFor(exec: Executor, date: string, quantity: number) {
  const period = ratePeriodForDate(date);
  if (!period) return { period, plans: [] };
  const catalog = (await activeRates(exec, date)).filter((r) => r.period === period);
  const plans = catalog
    .flatMap((r) => {
      const quote = quoteGroupRate(catalog, r.id, quantity);
      return quote ? [quote] : [];
    })
    .sort((a, b) => a.minutes - b.minutes);
  return { period, plans };
}

export async function reservationAvailability(
  db: Db,
  date: string,
  quantity: number,
  now = new Date(),
): Promise<ReservationAvailability> {
  const rules = reservationRules(await settingsMap(db));
  const { period, plans } = await plansFor(db, date, quantity);
  const base = {
    date,
    period,
    periodLabel: period ? RATE_PERIOD_LABEL[period] : null,
  };
  const closedReason = reservationDayError(rules, date, now);
  if (closedReason) return { ...base, closedReason, plans: [] };

  const [capacity, busy] = await Promise.all([
    fleetCapacity(db),
    occupancy(db, bogotaInstant(date, '00:00'), bogotaInstant(addDays(date, 1), '00:00')),
  ]);
  return {
    ...base,
    closedReason: plans.length === 0 ? 'No hay planes vigentes para esa fecha.' : null,
    plans: plans.map((rate) => ({
      rateId: rate.id,
      minutes: rate.minutes,
      quantity: rate.quantity,
      priceCents: rate.priceCents,
      label: planLabel(rate.minutes, rate.quantity),
      slots: startTimesFor(rules, rate.minutes)
        .filter((start) => !scheduleError(rules, date, start, rate.minutes, now))
        .map((start) => {
          const end = fromMinutes(toMinutes(start) + rate.minutes);
          const used = peakUsage(busy, bogotaInstant(date, start), bogotaInstant(date, end));
          return { start, end, available: capacity - used >= quantity };
        }),
    })),
  };
}

function endTimeOf(row: ReservationRow): string {
  return fromMinutes(toMinutes(timeOf(row.startsAt)) + row.durationMinutes);
}

function timeOf(at: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(at);
}

export function toPublicReservation(row: ReservationRow, contact: string): PublicReservation {
  const summary = {
    code: row.code,
    customerName: row.customerName,
    phone: row.phoneE164,
    date: row.serviceDate,
    startTime: timeOf(row.startsAt),
    endTime: endTimeOf(row),
    quantity: row.quantity,
    planLabel: row.planLabel,
    durationMinutes: row.durationMinutes,
    priceCents: row.priceCents,
  };
  return {
    ...summary,
    periodLabel: RATE_PERIOD_LABEL[row.ratePeriod],
    status: row.status,
    whatsappUrl: whatsappUrl(contact, reservationWhatsappMessage(summary)),
  };
}

function sameRequest(row: ReservationRow, input: CreateReservationRequest): boolean {
  return (
    row.phoneE164 === input.phone &&
    row.serviceDate === input.date &&
    timeOf(row.startsAt) === input.startTime &&
    row.quantity === input.quantity &&
    row.rateId === input.rateId
  );
}

export async function createReservation(
  db: Db,
  input: CreateReservationRequest,
  now = new Date(),
): Promise<{ reservation: PublicReservation; created: boolean }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.requestId}, 0))`);
    const config = await settingsMap(tx);
    const contact = contactNumber(config);

    const [existing] = await tx
      .select()
      .from(reservations)
      .where(eq(reservations.requestId, input.requestId))
      .limit(1);
    if (existing) {
      if (!sameRequest(existing, input)) throw conflict('Identificador de solicitud ya utilizado.');
      return { reservation: toPublicReservation(existing, contact), created: false };
    }

    // Un único candado para todas las altas: dos confirmaciones simultáneas no pueden
    // leer el mismo cupo libre. El volumen de reservas hace irrelevante la contención.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended('reservations:capacity', 0))`,
    );

    const rules: ReservationRules = reservationRules(config);
    const { period, plans } = await plansFor(tx, input.date, input.quantity);
    const rate = plans.find((r) => r.id === input.rateId);
    if (!period) throw badRequest('Ese día no tenemos atención. Elige otra fecha.');
    if (!rate) throw badRequest('Ese plan no está disponible para la fecha y cantidad elegidas.');

    const problem = scheduleError(rules, input.date, input.startTime, rate.minutes, now);
    if (problem) throw badRequest(problem);

    const startsAt = bogotaInstant(input.date, input.startTime);
    const endsAt = new Date(startsAt.getTime() + rate.minutes * 60_000);
    const [capacity, busy] = await Promise.all([
      fleetCapacity(tx),
      occupancy(tx, startsAt, endsAt),
    ]);
    if (capacity - peakUsage(busy, startsAt, endsAt) < input.quantity) {
      throw conflict(
        `No quedan ${String(input.quantity)} patinetas libres durante todo ese horario. Prueba otra hora o cantidad.`,
        'no_capacity',
      );
    }

    let code = newReservationCode();
    while (
      (
        await tx
          .select({ id: reservations.id })
          .from(reservations)
          .where(eq(reservations.code, code))
      ).length > 0
    ) {
      code = newReservationCode();
    }

    const [row] = await tx
      .insert(reservations)
      .values({
        code,
        requestId: input.requestId,
        customerName: input.customerName,
        phoneE164: input.phone,
        serviceDate: input.date,
        startsAt,
        endsAt,
        quantity: input.quantity,
        rateId: rate.id,
        ratePeriod: period,
        durationMinutes: rate.minutes,
        priceCents: rate.priceCents,
        planLabel: planLabel(rate.minutes, rate.quantity),
        // Queda apartada hasta que el equipo reciba el WhatsApp del cliente.
        status: 'pending',
      })
      .returning();
    if (!row) throw new Error('No se pudo registrar la reserva.');

    // Sin datos personales en la auditoría: basta con el código y lo comercial.
    await recordAudit(tx, {
      userId: null,
      action: 'reservation.create',
      entity: 'reservation',
      entityId: row.id,
      after: { code, quantity: row.quantity, priceCents: row.priceCents, startsAt },
    });
    return { reservation: toPublicReservation(row, contact), created: true };
  });
}

/** Vincula la reserva al alquiler que la inicia. Debe llamarse dentro de la transacción del alquiler. */
export async function lockReservationForRental(exec: Executor, reservationId: number) {
  const [row] = await exec
    .select()
    .from(reservations)
    .where(eq(reservations.id, reservationId))
    .for('update');
  if (!row) throw badRequest('La reserva no existe.');
  if (row.status !== 'confirmed' && row.status !== 'pending') {
    throw conflict(
      row.rentalId
        ? 'Esta reserva ya inició un alquiler.'
        : 'Esta reserva fue cancelada o cerrada y no puede iniciar un alquiler.',
    );
  }
  return row;
}

export async function rateById(exec: Executor, id: number) {
  const [row] = await exec.select().from(rates).where(eq(rates.id, id)).limit(1);
  return row ?? null;
}

export async function completeReservationsForRental(
  exec: Executor,
  rentalIds: number[],
  at: Date,
): Promise<void> {
  if (rentalIds.length === 0) return;
  await exec
    .update(reservations)
    .set({ status: 'completed', statusChangedAt: at })
    .where(and(inArray(reservations.rentalId, rentalIds), eq(reservations.status, 'in_rental')));
}
