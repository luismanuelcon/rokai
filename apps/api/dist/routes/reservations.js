import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { reservations, users } from '@rokai/db';
import { ChangeReservationStatus, CreateReservationRequest, DeleteRentalRequest, ReservationAvailabilityQuery, ReservationListQuery, fromMinutes, toMinutes, } from '@rokai/contracts';
import { HttpError, badRequest, conflict, notFound } from '../lib/http-error.js';
import { peakUsage } from '../domain/reservations.js';
import { recordAudit } from '../lib/audit.js';
import { createReservation, reservationAvailability, reservationOptions, fleetCapacity, occupancy, } from '../services/reservations.js';
const PAGE_SIZE = 25;
const changedBy = alias(users, 'status_user');
const TIME = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
});
const columns = {
    id: reservations.id,
    code: reservations.code,
    customerName: reservations.customerName,
    phone: reservations.phoneE164,
    date: reservations.serviceDate,
    startsAt: reservations.startsAt,
    durationMinutes: reservations.durationMinutes,
    quantity: reservations.quantity,
    planLabel: reservations.planLabel,
    ratePeriod: reservations.ratePeriod,
    rateId: reservations.rateId,
    priceCents: reservations.priceCents,
    status: reservations.status,
    statusReason: reservations.statusReason,
    statusChangedAt: reservations.statusChangedAt,
    statusChangedByName: changedBy.name,
    rentalId: reservations.rentalId,
    createdAt: reservations.createdAt,
};
function withTimes(row) {
    const startTime = TIME.format(row.startsAt);
    return {
        ...row,
        startTime,
        endTime: fromMinutes(toMinutes(startTime) + row.durationMinutes),
    };
}
export function registerReservationRoutes(app, db, env) {
    const guarded = { onRequest: [app.requireAuth] };
    const idParam = (params) => {
        const id = Number(params.id);
        if (!Number.isSafeInteger(id) || id <= 0)
            throw badRequest('Reserva no válida.');
        return id;
    };
    /* --------------------------------------------------------------- público */
    app.get('/api/v1/public/reservations/options', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (_req, reply) => {
        void reply.header('Cache-Control', 'no-store');
        return reservationOptions(db);
    });
    app.get('/api/v1/public/reservations/availability', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
        void reply.header('Cache-Control', 'no-store');
        const query = ReservationAvailabilityQuery.parse(req.query);
        return reservationAvailability(db, query.date, query.quantity);
    });
    app.post('/api/v1/public/reservations', { config: { rateLimit: { max: env.RESERVATION_RATE_LIMIT, timeWindow: '10 minutes' } } }, async (req, reply) => {
        void reply.header('Cache-Control', 'no-store');
        const input = CreateReservationRequest.parse(req.body);
        try {
            const result = await createReservation(db, input);
            return await reply.status(result.created ? 201 : 200).send(result.reservation);
        }
        catch (error) {
            if (error instanceof HttpError)
                throw error;
            // Los errores de PostgreSQL pueden citar el teléfono o el nombre: no se registran.
            req.log.error({ code: error.code }, 'Fallo al crear reserva');
            throw new HttpError(503, 'No pudimos registrar la reserva. Intenta de nuevo en un momento.');
        }
    });
    /* ------------------------------------------------------------ gestión */
    app.get('/api/v1/reservations', guarded, async (req) => {
        const q = ReservationListQuery.parse(req.query);
        const filters = [];
        if (q.search) {
            const term = `%${q.search.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
            const digits = q.search.replace(/\D/g, '');
            const match = or(ilike(reservations.code, term), ilike(reservations.customerName, term), ...(digits.length >= 3 ? [ilike(reservations.phoneE164, `%${digits}%`)] : []));
            if (match)
                filters.push(match);
        }
        if (q.date)
            filters.push(eq(reservations.serviceDate, q.date));
        if (q.status)
            filters.push(eq(reservations.status, q.status));
        const where = filters.length > 0 ? and(...filters) : undefined;
        const order = q.sort === 'start_desc'
            ? [desc(reservations.startsAt), desc(reservations.id)]
            : q.sort === 'created_desc'
                ? [desc(reservations.createdAt), desc(reservations.id)]
                : [asc(reservations.startsAt), asc(reservations.id)];
        const [totalRow] = await db.select({ total: count() }).from(reservations).where(where);
        const total = totalRow?.total ?? 0;
        const page = Math.min(q.page, Math.max(1, Math.ceil(total / PAGE_SIZE)));
        const rows = await db
            .select(columns)
            .from(reservations)
            .leftJoin(changedBy, eq(changedBy.id, reservations.statusChangedBy))
            .where(where)
            .orderBy(...order)
            .limit(PAGE_SIZE)
            .offset((page - 1) * PAGE_SIZE);
        return { items: rows.map(withTimes), total, page, pageSize: PAGE_SIZE };
    });
    app.get('/api/v1/reservations/:id', guarded, async (req) => {
        const [row] = await db
            .select(columns)
            .from(reservations)
            .leftJoin(changedBy, eq(changedBy.id, reservations.statusChangedBy))
            .where(eq(reservations.id, idParam(req.params)))
            .limit(1);
        if (!row)
            throw notFound('Reserva no encontrada.');
        return withTimes(row);
    });
    app.post('/api/v1/reservations/:id/status', guarded, async (req) => {
        const id = idParam(req.params);
        const body = ChangeReservationStatus.parse(req.body);
        const userId = req.session.user.id;
        await db.transaction(async (tx) => {
            await tx.execute(sql `select pg_advisory_xact_lock(hashtextextended('reservations:capacity', 0))`);
            const [before] = await tx
                .select()
                .from(reservations)
                .where(eq(reservations.id, id))
                .for('update');
            if (!before)
                throw notFound('Reserva no encontrada.');
            const allowed = before.status === 'pending' ||
                (before.status === 'confirmed' && body.status !== 'confirmed');
            if (!allowed) {
                throw conflict(body.status === 'confirmed'
                    ? 'Solo se confirma una reserva pendiente de WhatsApp.'
                    : 'Solo se puede cancelar o cerrar una reserva pendiente o confirmada.');
            }
            if (body.status === 'confirmed') {
                const [capacity, busy] = await Promise.all([
                    fleetCapacity(tx),
                    occupancy(tx, before.startsAt, before.endsAt, before.id),
                ]);
                if (capacity - peakUsage(busy, before.startsAt, before.endsAt) < before.quantity) {
                    throw conflict('No hay suficientes patinetas disponibles durante todo el horario de la reserva.', 'no_capacity');
                }
            }
            const changedAt = new Date();
            await tx
                .update(reservations)
                .set({
                status: body.status,
                statusReason: body.reason || null,
                statusChangedAt: changedAt,
                statusChangedBy: userId,
            })
                .where(eq(reservations.id, id));
            await recordAudit(tx, {
                userId,
                action: `reservation.${body.status}`,
                entity: 'reservation',
                entityId: id,
                before: { status: before.status },
                after: { status: body.status, reason: body.reason, code: before.code },
            });
        });
        return { ok: true };
    });
    // Solo administración: el registro desaparece, pero la justificación queda en Trazabilidad.
    app.delete('/api/v1/admin/reservations/:id', { onRequest: [app.requireAdmin] }, async (req) => {
        const id = idParam(req.params);
        const { reason } = DeleteRentalRequest.parse(req.body);
        await db.transaction(async (tx) => {
            await tx.execute(sql `select pg_advisory_xact_lock(hashtextextended('reservations:capacity', 0))`);
            const [before] = await tx
                .select()
                .from(reservations)
                .where(eq(reservations.id, id))
                .for('update');
            if (!before)
                throw notFound('Reserva no encontrada.');
            await tx.delete(reservations).where(eq(reservations.id, id));
            // Sin nombre ni teléfono: la auditoría no debe conservar datos personales borrados.
            await recordAudit(tx, {
                userId: req.session.user.id,
                action: 'reservation.delete',
                entity: 'reservation',
                entityId: id,
                before: {
                    code: before.code,
                    status: before.status,
                    startsAt: before.startsAt,
                    quantity: before.quantity,
                    priceCents: before.priceCents,
                    rentalId: before.rentalId,
                },
                after: { reason },
            });
        });
        return { ok: true };
    });
}
//# sourceMappingURL=reservations.js.map