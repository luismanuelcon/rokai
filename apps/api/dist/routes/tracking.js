import { PublicTracking } from '@rokai/contracts';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { equipment, rentalEquipment, rentalTracking, rentals, settings } from '@rokai/db';
import { ensureTracking } from '../services/tracking.js';
import { trackingClock, trackingPath, validTrackingToken } from '../domain/tracking.js';
import { badRequest, HttpError, notFound } from '../lib/http-error.js';
import { recordAudit } from '../lib/audit.js';
export function registerTrackingRoutes(app, db) {
    const id = (params) => {
        const value = Number(params.id);
        if (!Number.isSafeInteger(value) || value <= 0)
            throw badRequest('Alquiler no válido.');
        return value;
    };
    app.get('/api/v1/rentals/:id/tracking', { onRequest: [app.requireAuth] }, async (req, reply) => {
        reply.header('Cache-Control', 'no-store');
        const link = await db.transaction((tx) => ensureTracking(tx, id(req.params)));
        return { path: link.revokedAt ? null : trackingPath(link.token), revoked: !!link.revokedAt };
    });
    app.post('/api/v1/admin/rentals/:id/tracking/revoke', { onRequest: [app.requireAdmin] }, async (req) => {
        const rentalId = id(req.params);
        await db.transaction(async (tx) => {
            const link = await ensureTracking(tx, rentalId);
            if (!link.revokedAt) {
                await tx
                    .update(rentalTracking)
                    .set({ revokedAt: new Date() })
                    .where(eq(rentalTracking.rentalId, rentalId));
                await recordAudit(tx, {
                    userId: req.session.user.id,
                    action: 'tracking.revoke',
                    entity: 'rental',
                    entityId: rentalId,
                });
            }
        });
        return { ok: true };
    });
    app.get('/api/v1/tracking/:token', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
        reply.header('Cache-Control', 'no-store').header('X-Robots-Tag', 'noindex, nofollow');
        const token = req.params.token;
        if (!validTrackingToken(token))
            throw notFound('Este enlace no está disponible.');
        try {
            const [row] = await db
                .select({
                startedAt: rentals.startedAt,
                preparationMinutes: rentals.preparationMinutes,
                dueAt: rentals.dueAt,
                minutes: rentals.minutes,
                endedAt: rentals.endedAt,
                scooterCount: sql `(select count(*) from ${rentalEquipment} re join ${equipment} e on e.id = re.equipment_id where re.rental_id = ${rentals.id} and e.kind = 'scooter')`.mapWith(Number),
            })
                .from(rentalTracking)
                .innerJoin(rentals, eq(rentals.id, rentalTracking.rentalId))
                .where(and(eq(rentalTracking.token, token), isNull(rentalTracking.revokedAt)))
                .limit(1);
            if (!row)
                throw notFound('Este enlace no está disponible.');
            const [contact] = await db
                .select({ value: settings.value })
                .from(settings)
                .where(eq(settings.key, 'whatsapp'));
            const now = new Date();
            return PublicTracking.parse({
                ...trackingClock(row.dueAt, row.endedAt, now),
                serverNow: now.toISOString(),
                startedAt: row.startedAt.toISOString(),
                preparationEndsAt: new Date(row.startedAt.getTime() + row.preparationMinutes * 60000).toISOString(),
                dueAt: row.dueAt.toISOString(),
                minutes: row.minutes,
                scooterCount: row.scooterCount,
                whatsapp: contact?.value.replace(/\D/g, '') ?? '',
            });
        }
        catch (error) {
            if (error instanceof HttpError)
                throw error;
            // No propagar errores SQL que puedan contener el token en los parámetros.
            throw new HttpError(503, 'No pudimos consultar el seguimiento. Intenta de nuevo.');
        }
    });
}
//# sourceMappingURL=tracking.js.map