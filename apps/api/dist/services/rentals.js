import { ensureTracking } from './tracking.js';
import { trackingPath } from '../domain/tracking.js';
import { eq, sql } from 'drizzle-orm';
import { consents, notifications, rentalDrafts, rentalEquipment, rentals, reservations, settings, } from '@rokai/db';
import { TERMS_VERSION, } from '@rokai/contracts';
import { assertAssignable, lateChargeAtTime } from '../domain/rentals.js';
import { recordAudit } from '../lib/audit.js';
import { addMinutes, todayInBogota } from '../lib/time.js';
import { badRequest, conflict, notFound } from '../lib/http-error.js';
import { activeRates } from '../repositories/catalog.js';
import { completeReservationsForRental, lockReservationForRental, rateById, } from './reservations.js';
import { findByRequestId, findRental, lockEquipmentForUpdate, upsertCustomer, } from '../repositories/rentals.js';
export async function createRental(db, actor, input) {
    return db.transaction(async (tx) => {
        await tx.execute(sql `select pg_advisory_xact_lock(hashtextextended(${input.requestId}, 0))`);
        const existing = await findByRequestId(tx, input.requestId);
        if (existing) {
            // Reintento del mismo usuario: se devuelve el alquiler ya creado.
            if (existing.createdBy !== actor.id)
                throw conflict('Identificador ya utilizado.');
            const link = await ensureTracking(tx, existing.id);
            return {
                id: existing.id,
                idempotent: true,
                trackingPath: link.revokedAt ? null : trackingPath(link.token),
            };
        }
        const reservation = input.reservationId
            ? await lockReservationForRental(tx, input.reservationId)
            : null;
        const rate = (await activeRates(tx)).find((r) => r.id === input.rateId) ??
            (reservation && reservation.rateId === input.rateId
                ? await rateById(tx, input.rateId)
                : null);
        if (!rate)
            throw badRequest('Selecciona una tarifa vigente.');
        if (reservation &&
            (rate.minutes !== reservation.durationMinutes || rate.quantity !== reservation.quantity)) {
            throw badRequest('El plan debe coincidir con la reserva: misma duración y cantidad de patinetas.');
        }
        // El cliente conserva el valor que vio al reservar, aunque la tarifa haya cambiado.
        const priceCents = reservation ? reservation.priceCents : rate.priceCents;
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
        const [preparation] = await tx
            .select({ value: settings.value })
            .from(settings)
            .where(eq(settings.key, 'preparationMinutes'));
        const grace = preparation?.value === undefined ? 1 : Number(preparation.value);
        const preparationMinutes = Number.isInteger(grace) && grace >= 0 && grace <= 30 ? grace : 1;
        // Conservar el momento de entrega; la preparación queda fijada por alquiler.
        const startedAt = new Date();
        const inserted = await tx
            .insert(rentals)
            .values({
            customerId,
            rateId: rate.id,
            minutes: rate.minutes,
            priceCents,
            startedAt,
            preparationMinutes,
            dueAt: addMinutes(startedAt, rate.minutes + preparationMinutes),
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
            minutes: rate.minutes + preparationMinutes,
        });
        await recordAudit(tx, {
            userId: actor.id,
            action: 'crear_alquiler',
            entity: 'rental',
            entityId: rentalId,
            after: {
                customer: input.customer.document,
                rateId: rate.id,
                priceCents,
                reservation: reservation?.code ?? null,
            },
        });
        if (reservation) {
            await tx
                .update(reservations)
                .set({
                status: 'in_rental',
                rentalId,
                statusChangedAt: startedAt,
                statusChangedBy: actor.id,
            })
                .where(eq(reservations.id, reservation.id));
        }
        await tx.delete(rentalDrafts).where(eq(rentalDrafts.userId, actor.id));
        const link = await ensureTracking(tx, rentalId);
        return { id: rentalId, idempotent: false, trackingPath: trackingPath(link.token) };
    });
}
export async function finishRental(db, actor, rentalId, input) {
    await db.transaction(async (tx) => {
        const rental = await findRental(tx, rentalId);
        if (!rental)
            throw notFound('Alquiler no encontrado.');
        if (rental.endedAt)
            throw conflict('El alquiler ya fue finalizado.');
        const endedAt = new Date(`${todayInBogota()}T${input.returnTime}:00-05:00`);
        if (endedAt < rental.startedAt) {
            throw badRequest('La hora de devolución no puede ser anterior al inicio del alquiler.');
        }
        const late = lateChargeAtTime(rental.dueAt, input.returnTime, await lateFeePerMinute(tx));
        const mergedNotes = [rental.notes, input.notes].filter(Boolean).join('\n');
        await tx
            .update(rentals)
            .set({
            endedAt,
            endedBy: actor.id,
            lateMinutes: late.minutes,
            lateFeeCents: late.cents,
            finalPriceCents: rental.priceCents + late.cents,
            paymentMethod: input.paymentMethod,
            notes: mergedNotes,
        })
            .where(eq(rentals.id, rentalId));
        // Las notificaciones pendientes del alquiler dejan de tener sentido.
        await tx
            .update(notifications)
            .set({ status: 'failed', lastError: 'Alquiler finalizado antes del envío.' })
            .where(sql `${notifications.rentalId} = ${rentalId} AND ${notifications.status} = 'pending'
            AND ${notifications.templateKey} IN ('rental.due_soon', 'rental.overdue')`);
        await completeReservationsForRental(tx, [rentalId], endedAt);
        await recordAudit(tx, {
            userId: actor.id,
            action: 'finalizar_alquiler',
            entity: 'rental',
            entityId: rentalId,
            after: {
                finalPriceCents: rental.priceCents + late.cents,
                lateMinutes: late.minutes,
                lateFeeCents: late.cents,
                endedAt: endedAt.toISOString(),
                paymentMethod: input.paymentMethod,
            },
        });
    });
}
/**
 * El recargo se lee al cerrar, no al abrir: es la tarifa vigente en el momento
 * de la devolución. Un valor corrupto no debe bloquear la operación, así que
 * cae a cero.
 */
async function lateFeePerMinute(exec) {
    const rows = await exec
        .select({ value: settings.value })
        .from(settings)
        .where(eq(settings.key, 'lateFeePerMinuteCents'))
        .limit(1);
    const parsed = Number(rows[0]?.value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
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