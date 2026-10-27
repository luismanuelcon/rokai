import { asc, desc, eq, sql } from 'drizzle-orm';
import { auditLog, equipment, faqs, notifications, rates, rentals, settings, users, } from '@rokai/db';
import { CreateEquipmentRequest, CreateRateRequest, CreateUserRequest, PublicSettings, UpdateEquipmentRequest, UpdateRateRequest, UpdateUserRequest, UpsertFaqRequest, } from '@rokai/contracts';
import { hashPassword } from '../lib/crypto.js';
import { recordAudit } from '../lib/audit.js';
import { badRequest, conflict, notFound } from '../lib/http-error.js';
import { allRates, equipmentById } from '../repositories/catalog.js';
import { readSettings } from './public.js';
import { revokeSessions } from './auth.js';
function idParam(req) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
        throw badRequest('Identificador no válido.');
    return id;
}
export function registerAdminRoutes(app, db) {
    const admin = { onRequest: [app.requireAdmin] };
    app.get('/api/v1/admin/data', admin, async () => {
        const [rateRows, userRows, faqRows, config, audit] = await Promise.all([
            allRates(db),
            db
                .select({
                id: users.id,
                name: users.name,
                email: users.email,
                role: users.role,
                active: users.active,
            })
                .from(users)
                .orderBy(asc(users.name)),
            db.select().from(faqs).orderBy(asc(faqs.position), asc(faqs.id)),
            readSettings(db),
            db
                .select({
                id: auditLog.id,
                action: auditLog.action,
                entity: auditLog.entity,
                entityId: auditLog.entityId,
                createdAt: auditLog.createdAt,
                name: users.name,
            })
                .from(auditLog)
                .leftJoin(users, eq(users.id, auditLog.userId))
                .orderBy(desc(auditLog.id))
                .limit(300),
        ]);
        return { rates: rateRows, users: userRows, faqs: faqRows, settings: config, audit };
    });
    /* ------------------------------------------------------------- usuarios */
    app.post('/api/v1/admin/users', admin, async (req, reply) => {
        const body = CreateUserRequest.parse(req.body);
        const existing = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, body.email));
        if (existing.length > 0)
            throw conflict('Este correo ya está registrado.');
        const created = await db
            .insert(users)
            .values({
            name: body.name,
            email: body.email,
            passwordHash: hashPassword(body.password),
            role: body.role,
        })
            .returning({ id: users.id });
        await recordAudit(db, {
            userId: req.session.user.id,
            action: 'crear_usuario',
            entity: 'user',
            entityId: created[0].id,
            after: { email: body.email, role: body.role },
        });
        return reply.status(201).send({ ok: true, id: created[0].id });
    });
    app.patch('/api/v1/admin/users/:id', admin, async (req) => {
        const id = idParam(req);
        if (id === req.session.user.id)
            throw badRequest('No puedes desactivar tu propia cuenta.');
        const body = UpdateUserRequest.parse(req.body);
        const updated = await db
            .update(users)
            .set({ active: body.active })
            .where(eq(users.id, id))
            .returning({ id: users.id });
        if (updated.length === 0)
            throw notFound('Usuario no encontrado.');
        if (!body.active)
            await revokeSessions(db, id);
        await recordAudit(db, {
            userId: req.session.user.id,
            action: body.active ? 'activar_usuario' : 'desactivar_usuario',
            entity: 'user',
            entityId: id,
        });
        return { ok: true };
    });
    /* -------------------------------------------------------------- tarifas */
    app.post('/api/v1/admin/rates', admin, async (req, reply) => {
        const body = CreateRateRequest.parse(req.body);
        const created = await db.insert(rates).values(body).returning({ id: rates.id });
        await recordAudit(db, {
            userId: req.session.user.id,
            action: 'crear_tarifa',
            entity: 'rate',
            entityId: created[0].id,
            after: body,
        });
        return reply.status(201).send({ ok: true });
    });
    app.patch('/api/v1/admin/rates/:id', admin, async (req) => {
        const id = idParam(req);
        const body = UpdateRateRequest.parse(req.body);
        const before = await db.select().from(rates).where(eq(rates.id, id)).limit(1);
        if (before.length === 0)
            throw notFound('Tarifa no encontrada.');
        await db.update(rates).set(body).where(eq(rates.id, id));
        await recordAudit(db, {
            userId: req.session.user.id,
            action: 'editar_tarifa',
            entity: 'rate',
            entityId: id,
            before: before[0],
            after: body,
        });
        return { ok: true };
    });
    app.delete('/api/v1/admin/rates/:id', admin, async (req) => {
        const id = idParam(req);
        const before = await db.select().from(rates).where(eq(rates.id, id)).limit(1);
        if (before.length === 0)
            throw notFound('Tarifa no encontrada.');
        // `rentals.rate_id` guarda la tarifa aplicada: borrarla rompería la
        // trazabilidad del histórico, así que esas solo se desactivan.
        const used = await db
            .select({ id: rentals.id })
            .from(rentals)
            .where(eq(rentals.rateId, id))
            .limit(1);
        if (used.length > 0) {
            throw conflict('Esta tarifa ya se aplicó en un alquiler. Desactívala en lugar de borrarla.');
        }
        await db.delete(rates).where(eq(rates.id, id));
        await recordAudit(db, {
            userId: req.session.user.id,
            action: 'eliminar_tarifa',
            entity: 'rate',
            entityId: id,
            before: before[0],
        });
        return { ok: true };
    });
    /* -------------------------------------------------------------- equipos */
    app.post('/api/v1/admin/equipment', admin, async (req, reply) => {
        const body = CreateEquipmentRequest.parse(req.body);
        const existing = await db
            .select({ id: equipment.id })
            .from(equipment)
            .where(eq(equipment.code, body.code));
        if (existing.length > 0)
            throw conflict('El código ya existe.');
        const created = await db.insert(equipment).values(body).returning({ id: equipment.id });
        await recordAudit(db, {
            userId: req.session.user.id,
            action: 'crear_equipo',
            entity: 'equipment',
            entityId: created[0].id,
            after: body,
        });
        return reply.status(201).send({ ok: true });
    });
    app.patch('/api/v1/admin/equipment/:id', admin, async (req) => {
        const id = idParam(req);
        const body = UpdateEquipmentRequest.parse(req.body);
        const current = await equipmentById(db, id);
        if (!current)
            throw notFound('Equipo no encontrado.');
        if (current.busy)
            throw conflict('No puedes modificar un equipo en alquiler.');
        await db.update(equipment).set({ status: body.status }).where(eq(equipment.id, id));
        await recordAudit(db, {
            userId: req.session.user.id,
            action: 'editar_equipo',
            entity: 'equipment',
            entityId: id,
            before: { status: current.status },
            after: body,
        });
        return { ok: true };
    });
    /* ------------------------------------------------------------ preguntas */
    app.post('/api/v1/admin/faqs', admin, async (req, reply) => {
        const body = UpsertFaqRequest.parse(req.body);
        const created = await db.insert(faqs).values(body).returning({ id: faqs.id });
        await recordAudit(db, {
            userId: req.session.user.id,
            action: 'crear_pregunta',
            entity: 'faq',
            entityId: created[0].id,
        });
        return reply.status(201).send({ ok: true });
    });
    app.patch('/api/v1/admin/faqs/:id', admin, async (req) => {
        const id = idParam(req);
        const body = UpsertFaqRequest.parse(req.body);
        const updated = await db
            .update(faqs)
            .set(body)
            .where(eq(faqs.id, id))
            .returning({ id: faqs.id });
        if (updated.length === 0)
            throw notFound('Pregunta no encontrada.');
        await recordAudit(db, {
            userId: req.session.user.id,
            action: 'editar_pregunta',
            entity: 'faq',
            entityId: id,
            after: body,
        });
        return { ok: true };
    });
    /* ----------------------------------------------------------- ajustes */
    app.put('/api/v1/admin/settings', admin, async (req) => {
        const body = PublicSettings.parse(req.body);
        const before = await readSettings(db);
        await db.transaction(async (tx) => {
            for (const [key, value] of Object.entries(body)) {
                await tx
                    .insert(settings)
                    .values({ key, value })
                    .onConflictDoUpdate({
                    target: settings.key,
                    set: { value: sql `excluded.value`, updatedAt: sql `now()` },
                });
            }
        });
        await recordAudit(db, {
            userId: req.session.user.id,
            action: 'editar_configuracion',
            entity: 'settings',
            entityId: 'publica',
            before,
            after: body,
        });
        return { ok: true };
    });
    /* ----------------------------------------------------- notificaciones */
    app.get('/api/v1/admin/notifications', admin, async () => db.select().from(notifications).orderBy(desc(notifications.id)).limit(200));
    app.post('/api/v1/admin/notifications/:id/retry', admin, async (req) => {
        const id = idParam(req);
        const updated = await db
            .update(notifications)
            .set({ status: 'pending', attempts: 0, nextAttemptAt: new Date(), lastError: null })
            .where(eq(notifications.id, id))
            .returning({ id: notifications.id });
        if (updated.length === 0)
            throw notFound('Notificación no encontrada.');
        return { ok: true };
    });
}
//# sourceMappingURL=admin.js.map