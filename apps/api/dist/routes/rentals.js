import { eq } from 'drizzle-orm';
import { rentalDrafts } from '@rokai/db';
import { CreateRentalRequest, FinishRentalRequest, RentalDraft } from '@rokai/contracts';
import { badRequest } from '../lib/http-error.js';
import { activeRates, equipmentWithBusy } from '../repositories/catalog.js';
import { listRentals } from '../repositories/rentals.js';
import { createRental, finishRental } from '../services/rentals.js';
export function registerRentalRoutes(app, db) {
    const guarded = { onRequest: [app.requireAuth] };
    app.get('/api/v1/dashboard', guarded, async () => {
        const [rentals, equipment, rates] = await Promise.all([
            listRentals(db),
            equipmentWithBusy(db),
            activeRates(db),
        ]);
        return { rentals, equipment, rates };
    });
    app.get('/api/v1/rentals', guarded, async (req) => {
        const query = req.query;
        return listRentals(db, { onlyActive: query.status === 'active' });
    });
    app.post('/api/v1/rentals', guarded, async (req, reply) => {
        const input = CreateRentalRequest.parse(req.body);
        const result = await createRental(db, req.session.user, input);
        return reply.status(result.idempotent ? 200 : 201).send({ id: result.id });
    });
    app.post('/api/v1/rentals/:id/finish', guarded, async (req) => {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0)
            throw badRequest('Identificador no válido.');
        const body = FinishRentalRequest.parse(req.body ?? {});
        await finishRental(db, req.session.user, id, body.notes);
        return { ok: true };
    });
    app.get('/api/v1/draft', guarded, async (req) => {
        const rows = await db
            .select()
            .from(rentalDrafts)
            .where(eq(rentalDrafts.userId, req.session.user.id))
            .limit(1);
        return rows[0]?.content ?? {};
    });
    app.put('/api/v1/draft', guarded, async (req) => {
        const content = RentalDraft.parse(req.body ?? {});
        await db
            .insert(rentalDrafts)
            .values({ userId: req.session.user.id, content })
            .onConflictDoUpdate({
            target: rentalDrafts.userId,
            set: { content, updatedAt: new Date() },
        });
        return { ok: true };
    });
    app.delete('/api/v1/draft', guarded, async (req) => {
        await db.delete(rentalDrafts).where(eq(rentalDrafts.userId, req.session.user.id));
        return { ok: true };
    });
}
//# sourceMappingURL=rentals.js.map