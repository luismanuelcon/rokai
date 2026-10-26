import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { customers, equipment, rentalEquipment, rentals, users } from '@rokai/db';
const endedByUser = alias(users, 'ended_user');
/**
 * Una sola consulta con json_agg: el MVP hacía una consulta de equipos por alquiler.
 */
export async function listRentals(exec, filter = {}) {
    const rows = await exec
        .select({
        id: rentals.id,
        customerName: customers.fullName,
        customerDocumentType: customers.documentType,
        customerDocument: customers.document,
        customerPhone: customers.phoneE164,
        minutes: rentals.minutes,
        priceCents: rentals.priceCents,
        finalPriceCents: rentals.finalPriceCents,
        startedAt: rentals.startedAt,
        dueAt: rentals.dueAt,
        endedAt: rentals.endedAt,
        createdByName: users.name,
        endedByName: endedByUser.name,
        notes: rentals.notes,
        equipment: sql `COALESCE((
        SELECT json_agg(json_build_object('code', e.code, 'kind', e.kind) ORDER BY e.code)
        FROM rental_equipment re JOIN equipment e ON e.id = re.equipment_id
        WHERE re.rental_id = "rentals"."id"
      ), '[]'::json)`,
    })
        .from(rentals)
        .innerJoin(customers, eq(customers.id, rentals.customerId))
        .innerJoin(users, eq(users.id, rentals.createdBy))
        .leftJoin(endedByUser, eq(endedByUser.id, rentals.endedBy))
        .where(filter.onlyActive ? isNull(rentals.endedAt) : sql `true`)
        .orderBy(desc(rentals.id))
        .limit(filter.limit ?? 200);
    return rows;
}
export async function findRental(exec, id) {
    const rows = await exec.select().from(rentals).where(eq(rentals.id, id)).limit(1);
    return rows[0] ?? null;
}
export async function findByRequestId(exec, requestId) {
    const rows = await exec
        .select({ id: rentals.id, createdBy: rentals.createdBy })
        .from(rentals)
        .where(eq(rentals.requestId, requestId))
        .limit(1);
    return rows[0] ?? null;
}
/**
 * Bloquea las filas de equipo seleccionadas durante la transacción.
 * Sustituye al `BEGIN IMMEDIATE` global del MVP por un bloqueo por fila.
 */
export async function lockEquipmentForUpdate(exec, ids) {
    if (ids.length === 0)
        return [];
    const locked = await exec
        .select({ id: equipment.id, kind: equipment.kind, status: equipment.status })
        .from(equipment)
        .where(inArray(equipment.id, [...ids]))
        .for('update');
    const busyRows = await exec
        .select({ equipmentId: rentalEquipment.equipmentId })
        .from(rentalEquipment)
        .innerJoin(rentals, eq(rentals.id, rentalEquipment.rentalId))
        .where(and(inArray(rentalEquipment.equipmentId, [...ids]), isNull(rentals.endedAt)));
    const busy = new Set(busyRows.map((r) => r.equipmentId));
    return locked.map((e) => ({ ...e, busy: busy.has(e.id) }));
}
export async function upsertCustomer(exec, input) {
    const inserted = await exec
        .insert(customers)
        .values({
        fullName: input.fullName,
        documentType: input.documentType,
        document: input.document,
        phoneE164: input.phone,
    })
        .onConflictDoUpdate({
        target: [customers.documentType, customers.document],
        set: {
            fullName: sql `excluded.full_name`,
            // No se borra un teléfono existente si el registro nuevo viene vacío.
            phoneE164: sql `COALESCE(excluded.phone_e164, ${customers.phoneE164})`,
            updatedAt: sql `now()`,
        },
    })
        .returning({ id: customers.id });
    const id = inserted[0]?.id;
    if (id === undefined)
        throw new Error('No se pudo registrar el cliente.');
    return id;
}
//# sourceMappingURL=rentals.js.map