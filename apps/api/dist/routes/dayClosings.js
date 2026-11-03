import { and, desc, eq, sql } from 'drizzle-orm';
import { dayClosings, rentals } from '@rokai/db';
import { ClosingDate, CreateDayClosingRequest, UpdateDayClosingRequest } from '@rokai/contracts';
import { recordAudit } from '../lib/audit.js';
import { badRequest, conflict, notFound } from '../lib/http-error.js';
export function registerDayClosingRoutes(app, db) {
    const admin = { onRequest: [app.requireAdmin] };
    app.get('/api/v1/admin/day-closings', admin, async () => db.select().from(dayClosings).orderBy(desc(dayClosings.date)));
    app.get('/api/v1/admin/day-closings/preview/:date', admin, async (req) => {
        const date = ClosingDate.parse(req.params.date);
        const [totals] = await db
            .select({
            cashCents: sql `coalesce(sum(${rentals.finalPriceCents}) filter (where ${rentals.paymentMethod} = 'cash'), 0)`.mapWith(Number),
            transferCents: sql `coalesce(sum(${rentals.finalPriceCents}) filter (where ${rentals.paymentMethod} = 'transfer'), 0)`.mapWith(Number),
            count: sql `count(*)`.mapWith(Number),
            unclassified: sql `count(*) filter (where ${rentals.paymentMethod} is null or ${rentals.finalPriceCents} is null)`.mapWith(Number),
        })
            .from(rentals)
            .where(sql `${rentals.endedAt} >= (${date}::date::timestamp at time zone 'America/Bogota') and ${rentals.endedAt} < ((${date}::date + 1)::timestamp at time zone 'America/Bogota')`);
        return { date, ...totals };
    });
    app.post('/api/v1/admin/day-closings', admin, async (req, reply) => {
        const body = CreateDayClosingRequest.parse(req.body);
        const userId = req.session.user.id;
        const result = await db.transaction(async (tx) => {
            const [created] = await tx
                .insert(dayClosings)
                .values({ ...body, createdBy: userId, updatedBy: userId })
                .onConflictDoNothing({ target: dayClosings.date })
                .returning();
            if (!created)
                throw conflict('Esta fecha ya tiene un cierre. Abre el existente para editarlo.');
            await recordAudit(tx, {
                userId,
                action: 'day_closing.create',
                entity: 'day_closing',
                entityId: created.id,
                after: created,
            });
            return created;
        });
        return reply.code(201).send(result);
    });
    app.put('/api/v1/admin/day-closings/:date', admin, async (req) => {
        const date = ClosingDate.parse(req.params.date);
        const { version, ...body } = UpdateDayClosingRequest.parse(req.body);
        if (date !== body.date)
            throw badRequest('La fecha de un cierre existente no se puede cambiar.');
        return db.transaction(async (tx) => {
            const [before] = await tx
                .select()
                .from(dayClosings)
                .where(eq(dayClosings.date, date))
                .for('update');
            if (!before)
                throw notFound('No existe un cierre para esa fecha.');
            if (before.version !== version)
                throw conflict('Otro administrador actualizó este cierre. Recarga los cierres y vuelve a abrirlo antes de guardar.');
            const [updated] = await tx
                .update(dayClosings)
                .set({
                ...body,
                version: version + 1,
                updatedAt: new Date(),
                updatedBy: req.session.user.id,
            })
                .where(and(eq(dayClosings.date, date), eq(dayClosings.version, version)))
                .returning();
            await recordAudit(tx, {
                userId: req.session.user.id,
                action: 'day_closing.update',
                entity: 'day_closing',
                entityId: before.id,
                before,
                after: updated,
            });
            return updated;
        });
    });
}
//# sourceMappingURL=dayClosings.js.map