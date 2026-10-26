import { asc, eq } from 'drizzle-orm';
import { faqs, settings } from '@rokai/db';
import { activeRates } from '../repositories/catalog.js';
export async function readSettings(db) {
    const rows = await db.select().from(settings);
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
export function registerPublicRoutes(app, db) {
    app.get('/api/v1/health', () => ({ status: 'ok' }));
    app.get('/api/v1/ready', async (_req, reply) => {
        try {
            await db.execute('select 1');
            return { status: 'ok' };
        }
        catch {
            return reply.status(503).send({ status: 'unavailable' });
        }
    });
    app.get('/api/v1/public', async (_req, reply) => {
        const [rates, faqRows, config] = await Promise.all([
            activeRates(db),
            db.select().from(faqs).where(eq(faqs.active, true)).orderBy(asc(faqs.position), asc(faqs.id)),
            readSettings(db),
        ]);
        // Contenido público y estable: una caché corta alivia el pico de visitas.
        void reply.header('Cache-Control', 'public, max-age=60');
        return { rates, faqs: faqRows, settings: config };
    });
}
//# sourceMappingURL=public.js.map