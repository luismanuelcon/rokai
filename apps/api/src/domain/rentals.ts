import type { EquipmentKind, EquipmentStatus } from '@rokai/contracts';
import { conflict, badRequest } from '../lib/http-error.js';

export interface SelectableEquipment {
  id: number;
  kind: EquipmentKind;
  status: EquipmentStatus;
  busy: boolean;
}

/**
 * Regla de negocio pura: una patineta y un casco por persona, todo disponible.
 * Sin IO, por lo que se puede probar unitariamente.
 */
export function assertAssignable(
  selected: readonly SelectableEquipment[],
  requestedIds: readonly number[],
  quantity: number,
): void {
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
export function lateCharge(
  dueAt: Date,
  endedAt: Date,
  perMinuteCents: number,
): { minutes: number; cents: number } {
  const overdueMs = endedAt.getTime() - dueAt.getTime();
  if (overdueMs <= 0) return { minutes: 0, cents: 0 };
  const minutes = Math.ceil(overdueMs / 60_000);
  return { minutes, cents: perMinuteCents > 0 ? minutes * perMinuteCents : 0 };
}

/** Una tarifa está vigente si está activa y la fecha civil cae dentro del rango. */
export function isRateCurrent(
  rate: { active: boolean; validFrom: string | null; validUntil: string | null },
  today: string,
): boolean {
  if (!rate.active) return false;
  if (rate.validFrom && rate.validFrom > today) return false;
  if (rate.validUntil && rate.validUntil < today) return false;
  return true;
}
