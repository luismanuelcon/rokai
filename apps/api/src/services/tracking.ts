import { eq } from 'drizzle-orm';
import { rentalTracking, rentals } from '@rokai/db';
import type { Executor } from '../db.js';
import { newTrackingToken } from '../domain/tracking.js';
import { notFound } from '../lib/http-error.js';

/** Ejecutar dentro de una transacción: el bloqueo evita crear dos enlaces. */
export async function ensureTracking(tx: Executor, rentalId: number) {
  const [rental] = await tx
    .select({ id: rentals.id })
    .from(rentals)
    .where(eq(rentals.id, rentalId))
    .for('update');
  if (!rental) throw notFound('Alquiler no encontrado.');
  const [existing] = await tx
    .select()
    .from(rentalTracking)
    .where(eq(rentalTracking.rentalId, rentalId));
  if (existing) return existing;
  const [created] = await tx
    .insert(rentalTracking)
    .values({ rentalId, token: newTrackingToken() })
    .returning();
  return created!;
}
