import { asc, eq, sql } from 'drizzle-orm';
import { equipment, rates } from '@rokai/db';
import type { Executor } from '../db.js';
import { todayInBogota } from '../lib/time.js';

export interface RateRow {
  id: number;
  period: 'special' | 'weekend';
  minutes: number;
  quantity: number;
  priceCents: number;
  active: boolean;
  validFrom: string | null;
  validUntil: string | null;
}

/** Solo tarifas activas cuya vigencia cubre la fecha civil de Bogotá. */
export async function activeRates(exec: Executor, today = todayInBogota()): Promise<RateRow[]> {
  return exec
    .select()
    .from(rates)
    .where(
      sql`${rates.active} = true
        AND (${rates.validFrom} IS NULL OR ${rates.validFrom} <= ${today})
        AND (${rates.validUntil} IS NULL OR ${rates.validUntil} >= ${today})`,
    )
    .orderBy(asc(rates.period), asc(rates.minutes), asc(rates.quantity));
}

export async function allRates(exec: Executor): Promise<RateRow[]> {
  return exec
    .select()
    .from(rates)
    .orderBy(asc(rates.period), asc(rates.minutes), asc(rates.quantity));
}

export interface EquipmentRow {
  id: number;
  code: string;
  kind: 'scooter' | 'helmet';
  status: 'available' | 'maintenance' | 'inactive';
  busy: boolean;
}

// La referencia correlacionada se escribe calificada a propósito: al interpolar
// `equipment.id`, Drizzle emite `"id"` sin tabla y dentro de la subconsulta eso
// resuelve a `rentals.id`, marcando todo el inventario como ocupado.
const BUSY = sql<boolean>`EXISTS (
  SELECT 1 FROM rental_equipment re
  JOIN rentals r ON r.id = re.rental_id
  WHERE re.equipment_id = "equipment"."id" AND r.ended_at IS NULL
)`;

export async function equipmentWithBusy(exec: Executor): Promise<EquipmentRow[]> {
  const rows = await exec
    .select({
      id: equipment.id,
      code: equipment.code,
      kind: equipment.kind,
      status: equipment.status,
      busy: BUSY,
    })
    .from(equipment)
    .orderBy(asc(equipment.code));
  return rows;
}

export async function equipmentById(exec: Executor, id: number): Promise<EquipmentRow | null> {
  const rows = await exec
    .select({
      id: equipment.id,
      code: equipment.code,
      kind: equipment.kind,
      status: equipment.status,
      busy: BUSY,
    })
    .from(equipment)
    .where(eq(equipment.id, id))
    .limit(1);
  return rows[0] ?? null;
}
