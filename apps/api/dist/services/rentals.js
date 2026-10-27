import { eq, sql } from 'drizzle-orm';
import { consents, notifications, rentalDrafts, rentalEquipment, rentals } from '@rokai/db';
import { TERMS_VERSION } from '@rokai/contracts';
import { assertAssignable } from '../domain/rentals.js';
import { recordAudit } from '../lib/audit.js';
import { addMinutes } from '../lib/time.js';
import { badRequest, conflict, notFound } from '../lib/http-error.js';
import { activeRates } from '../repositories/catalog.js';
import { findByRequestId, findRental, lockEquipmentForUpdate, upsertCustomer, } from '../repositories/rentals.js';
export async function createRental(db, actor, input) {
    return db.transaction(async (tx) => {
        const existing = await findByRequestId(tx, input.requestId);
        if (existing) {
            // Reintento del mismo usuario: se devuelve el alquiler ya creado.
            if (existing.createdBy !== actor.id)
                throw conflict('Identificador ya utilizado.');
            return { id: existing.id, idempotent: true };
        }
        const rate = (await activeRates(tx)).find((r) => r.id === input.rateId);
        if (!rate)
            throw badRequest('Selecciona una tarifa vigente.');
        const locked = await lockEquipmentForUpdate(tx, input.equipmentIds);
        assertAssignable(locked, input.equipmentIds, rate.quantity);
        const customerId = await upsertCustomer(tx, {
            fullName: input.customer.fullName,
            documentType: input.customer.documentType,
            document: input.customer.document,
            phone: input.customer.phone,
        });
        // Base legal del servicio contratado. El consentimiento de marketing es fase 2.
        await tx.insert(consents).values({
            customerId,
            kind: 'operational',
            granted: true,
            channel: 'presencial',
            policyVersion: TERMS_VERSION,
        });
        const startedAt = new Date();
        const inserted = await tx
            .insert(rentals)
            .values({
            customerId,
            rateId: rate.id,
            minutes: rate.minutes,
            priceCents: rate.priceCents,
            startedAt,
            dueAt: addMinutes(startedAt, rate.minutes),
            createdBy: actor.id,
            notes: input.notes,
            signature: input.signature,
            termsVersion: TERMS_VERSION,
            requestId: input.requestId,
        })
            .returning({ id: rentals.id });
        const rentalId = inserted[0]?.id;
        if (rentalId === undefined)
            throw new Error('No se pudo registrar el alquiler.');
        await tx
            .insert(rentalEquipment)
            .values(input.equipmentIds.map((equipmentId) => ({ rentalId, equipmentId })));
        await enqueueRentalNotifications(tx, {
            rentalId,
            customerId,
            phone: input.customer.phone,
            startedAt,
            minutes: rate.minutes,
        });
        await recordAudit(tx, {
            userId: actor.id,
            action: 'crear_alquiler',
            entity: 'rental',
            entityId: rentalId,
            after: { customer: input.customer.document, rateId: rate.id, priceCents: rate.priceCents },
        });
        await tx.delete(rentalDrafts).where(eq(rentalDrafts.userId, actor.id));
        return { id: rentalId, idempotent: false };
    });
}
export async function finishRental(db, actor, rentalId, notes) {
    await db.transaction(async (tx) => {
        const rental = await findRental(tx, rentalId);
        if (!rental)
            throw notFound('Alquiler no encontrado.');
        if (rental.endedAt)
            throw conflict('El alquiler ya fue finalizado.');
        const mergedNotes = [rental.notes, notes].filter(Boolean).join('\n');
        await tx
            .update(rentals)
            .set({
            endedAt: new Date(),
            endedBy: actor.id,
            // No se inventan recargos: el negocio aún no definió esa regla.
            finalPriceCents: rental.priceCents,
            notes: mergedNotes,
        })
            .where(eq(rentals.id, rentalId));
        // Las notificaciones pendientes del alquiler dejan de tener sentido.
        await tx
            .update(notifications)
            .set({ status: 'failed', lastError: 'Alquiler finalizado antes del envío.' })
            .where(sql `${notifications.rentalId} = ${rentalId} AND ${notifications.status} = 'pending'
            AND ${notifications.templateKey} IN ('rental.due_soon', 'rental.overdue')`);
        await recordAudit(tx, {
            userId: actor.id,
            action: 'finalizar_alquiler',
            entity: 'rental',
            entityId: rentalId,
            after: { finalPriceCents: rental.priceCents },
        });
    });
}
/** Patrón outbox: los mensajes se escriben en la misma transacción que el hecho. */
async function enqueueRentalNotifications(tx, args) {
    if (!args.phone)
        return;
    const dueAt = addMinutes(args.startedAt, args.minutes);
    const rows = [
        {
            templateKey: 'rental.started',
            scheduledFor: args.startedAt,
        },
        {
            templateKey: 'rental.due_soon',
            scheduledFor: addMinutes(dueAt, -10),
        },
        {
            templateKey: 'rental.overdue',
            scheduledFor: addMinutes(dueAt, 5),
        },
    ].map((r) => ({
        idempotencyKey: `${args.rentalId}:${r.templateKey}`,
        channel: 'whatsapp',
        category: 'utility',
        templateKey: r.templateKey,
        rentalId: args.rentalId,
        customerId: args.customerId,
        recipient: args.phone,
        scheduledFor: r.scheduledFor,
        nextAttemptAt: r.scheduledFor,
    }));
    await tx.insert(notifications).values(rows).onConflictDoNothing();
}
//# sourceMappingURL=rentals.js.map