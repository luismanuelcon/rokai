import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { seed } from '@rokai/db/seed';
import { migrationsFolder, users } from '@rokai/db';
import { buildApp } from './app.js';
import { connect } from './db.js';
import { loadEnv } from './env.js';
import { hashPassword } from './lib/crypto.js';
import { addDays, bogotaDate, ratePeriodForDate } from '@rokai/contracts';
const ORIGIN = 'http://127.0.0.1:3000';
const PASSWORD = 'Test-password-only-123';
/** PNG de 1x1 válido: lo mínimo que acepta el contrato de la firma. */
const SIGNATURE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
/** Campos de cierre que ahora exige todo alquiler. */
const CLOSING = { signature: SIGNATURE, termsAccepted: true };
function timeInBogota(date) {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Bogota',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).format(date);
}
let app;
let handle;
let admin;
let worker;
function testDatabaseUrl() {
    const base = process.env.DATABASE_URL;
    if (!base)
        throw new Error('DATABASE_URL no está definida.');
    return base.replace(/\/[^/]+$/, '/rokai_test');
}
async function ensureTestDatabase(url) {
    const adminClient = new pg.Client({ connectionString: url.replace(/\/[^/]+$/, '/postgres') });
    await adminClient.connect();
    try {
        const existing = await adminClient.query('select 1 from pg_database where datname = $1', [
            'rokai_test',
        ]);
        if (existing.rowCount === 0)
            await adminClient.query('CREATE DATABASE rokai_test');
    }
    finally {
        await adminClient.end();
    }
}
/** Deja la base en blanco entre ejecuciones para que las pruebas sean deterministas. */
async function resetSchema(h) {
    await h.db.execute(sql `DROP SCHEMA IF EXISTS public CASCADE`);
    await h.db.execute(sql `DROP SCHEMA IF EXISTS drizzle CASCADE`);
    await h.db.execute(sql `CREATE SCHEMA public`);
}
async function call(path, method = 'GET', body, actor, overrides = {}) {
    const headers = { origin: ORIGIN };
    if (actor) {
        headers['cookie'] = actor.cookie;
        headers['x-csrf-token'] = actor.csrf;
    }
    // Los overrides van al final para poder simular cabeceras inválidas.
    Object.assign(headers, overrides);
    const res = await app.inject({ method, url: path, headers, payload: body });
    let parsed = null;
    try {
        parsed = res.json();
    }
    catch {
        parsed = null;
    }
    return { status: res.statusCode, body: parsed, cookies: res.cookies };
}
async function login(email) {
    const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin: ORIGIN },
        payload: { email, password: PASSWORD },
    });
    assert.equal(res.statusCode, 200, `login de ${email} falló: ${res.body}`);
    const body = res.json();
    const cookie = res.cookies.find((c) => c.name === 'rokai_session');
    assert.ok(cookie, 'la respuesta debe traer cookie de sesión');
    return { cookie: `rokai_session=${cookie.value}`, csrf: body.csrf, id: body.user.id };
}
before(async () => {
    const url = testDatabaseUrl();
    await ensureTestDatabase(url);
    handle = connect(url);
    await resetSchema(handle);
    await migrate(handle.db, { migrationsFolder });
    await seed(handle.db);
    await handle.db.insert(users).values({
        name: 'Admin',
        email: 'admin@test.local',
        passwordHash: hashPassword(PASSWORD),
        role: 'admin',
    });
    app = await buildApp(loadEnv({
        ...process.env,
        DATABASE_URL: url,
        // TEST_LOG_LEVEL permite ver los errores del servidor al depurar.
        LOG_LEVEL: process.env['TEST_LOG_LEVEL'] ?? 'fatal',
        APP_ORIGIN: ORIGIN,
        RESERVATION_RATE_LIMIT: '1000',
    }), handle.db);
    await app.ready();
    admin = await login('admin@test.local');
});
after(async () => {
    await app.close();
    await handle.pool.end();
});
test('Información pública accesible y APIs privadas protegidas', async () => {
    const pub = await call('/api/v1/public');
    assert.equal(pub.status, 200);
    assert.equal(pub.body.rates.length, 16);
    assert.equal(pub.body.settings.whatsapp, '+573106817317');
    for (const path of ['/api/v1/dashboard', '/api/v1/draft', '/api/v1/admin/data']) {
        assert.equal((await call(path)).status, 401, path);
    }
    assert.equal((await call('/api/v1/rentals', 'POST', {})).status, 401);
});
test('Los assets públicos con nombre estable se revalidan', async () => {
    const hero = await app.inject('/assets/hero-rokai-atardecer.webp');
    assert.equal(hero.statusCode, 200);
    assert.equal(hero.headers['cache-control'], 'no-cache');
});
test('Login rechaza credenciales malas; la cookie es HttpOnly y SameSite', async () => {
    const bad = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin: ORIGIN },
        payload: { email: 'admin@test.local', password: 'incorrecta' },
    });
    assert.equal(bad.statusCode, 401);
    const good = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin: ORIGIN },
        payload: { email: 'admin@test.local', password: PASSWORD },
    });
    const raw = good.headers['set-cookie'];
    const header = Array.isArray(raw) ? raw.join(';') : String(raw);
    assert.match(header, /HttpOnly/i);
    assert.match(header, /SameSite=Strict/i);
});
test('Origen y CSRF se exigen en escrituras', async () => {
    const badCsrf = await call('/api/v1/draft', 'PUT', {}, admin, { 'x-csrf-token': 'invalido' });
    assert.equal(badCsrf.status, 403);
    const badOrigin = await call('/api/v1/draft', 'PUT', {}, admin, {
        origin: 'https://malicioso.example',
    });
    assert.equal(badOrigin.status, 403);
});
test('El trabajador no accede a administración; desactivar revoca la sesión', async () => {
    const created = await call('/api/v1/admin/users', 'POST', { name: 'Colaborador', email: 'worker@test.local', password: PASSWORD, role: 'collaborator' }, admin);
    assert.equal(created.status, 201);
    worker = await login('worker@test.local');
    assert.equal((await call('/api/v1/admin/data', 'GET', undefined, worker)).status, 403);
    assert.equal((await call('/api/v1/admin/rates', 'POST', {}, worker)).status, 403);
});
test('Los borradores son privados por usuario y no se filtran al público', async () => {
    const saved = await call('/api/v1/draft', 'PUT', { fullName: 'Cliente prueba', document: '123' }, worker);
    assert.equal(saved.status, 200);
    const mine = await call('/api/v1/draft', 'GET', undefined, worker);
    assert.equal(mine.body.fullName, 'Cliente prueba');
    const other = await call('/api/v1/draft', 'GET', undefined, admin);
    assert.deepEqual(other.body, {});
    const pub = await call('/api/v1/public');
    assert.ok(!JSON.stringify(pub.body).includes('Cliente prueba'));
});
test('Ciclo de alquiler: idempotencia, colisión, precio inmutable y auditoría', async () => {
    if (!worker) {
        const created = await call('/api/v1/admin/users', 'POST', { name: 'Colaborador', email: 'worker@test.local', password: PASSWORD, role: 'collaborator' }, admin);
        assert.equal(created.status, 201);
        worker = await login('worker@test.local');
    }
    const dash = await call('/api/v1/dashboard', 'GET', undefined, worker);
    const rate = dash.body.rates.find((r) => r.quantity === 1);
    const ids = dash.body.equipment
        .filter((e) => e.code.endsWith('01'))
        .map((e) => e.id);
    const payload = {
        requestId: '11111111-1111-4111-8111-111111111111',
        customer: { fullName: 'Cliente prueba', document: '12345', phone: '+573001112233' },
        rateId: rate.id,
        equipmentIds: ids,
        notes: '',
        ...CLOSING,
    };
    const first = await call('/api/v1/rentals', 'POST', payload, worker);
    assert.equal(first.status, 201);
    const rentalId = first.body.id;
    // Reintento con el mismo request_id: mismo alquiler, sin duplicar.
    const retry = await call('/api/v1/rentals', 'POST', payload, worker);
    assert.equal(retry.body.id, rentalId);
    // Otro usuario no puede reutilizar el identificador.
    const stolen = await call('/api/v1/rentals', 'POST', { ...payload, requestId: '22222222-2222-4222-8222-222222222222' }, admin);
    assert.equal(stolen.status, 409);
    // El precio enviado por el cliente se ignora: manda el del servidor.
    const after = await call('/api/v1/dashboard', 'GET', undefined, worker);
    assert.equal(after.body.rentals[0].priceCents, rate.priceCents);
    assert.equal(after.body.rentals[0].createdByName, 'Colaborador');
    assert.equal(after.body.equipment.filter((e) => e.busy).length, 2);
    // El borrador se elimina al confirmar.
    assert.deepEqual((await call('/api/v1/draft', 'GET', undefined, worker)).body, {});
    // Cambiar la tarifa no reescribe la historia.
    await call(`/api/v1/admin/rates/${rate.id}`, 'PATCH', { priceCents: 9_999_900, active: true, validFrom: null, validUntil: null }, admin);
    const endedAt = new Date();
    endedAt.setSeconds(0, 0);
    const returnTime = timeInBogota(endedAt);
    const dueAt = new Date(endedAt.getTime() - 2 * 60_000);
    const startedAt = new Date(dueAt.getTime() - 60 * 60_000);
    await handle.db.execute(sql `
    UPDATE rentals SET started_at = ${startedAt}, due_at = ${dueAt} WHERE id = ${rentalId}
  `);
    await handle.db.execute(sql `
    UPDATE settings SET value = '10000' WHERE key = 'lateFeePerMinuteCents'
  `);
    const beforeStart = timeInBogota(new Date(startedAt.getTime() - 60_000));
    const invalidPast = await call(`/api/v1/rentals/${rentalId}/finish`, 'POST', { paymentMethod: 'cash', returnTime: beforeStart }, worker);
    assert.equal(invalidPast.status, 400);
    // La devolución manual puede estar más de cinco minutos por delante del reloj.
    const realNow = Date.now;
    Date.now = () => endedAt.getTime() - 10 * 60_000;
    try {
        const finished = await call(`/api/v1/rentals/${rentalId}/finish`, 'POST', { notes: 'Sin novedades', paymentMethod: 'cash', returnTime }, worker);
        assert.equal(finished.status, 200);
    }
    finally {
        Date.now = realNow;
    }
    assert.equal((await call(`/api/v1/rentals/${rentalId}/finish`, 'POST', { paymentMethod: 'cash', returnTime }, worker)).status, 409);
    const final = await call('/api/v1/dashboard', 'GET', undefined, worker);
    assert.equal(timeInBogota(new Date(final.body.rentals[0].endedAt)), returnTime);
    assert.equal(final.body.rentals[0].lateMinutes, 2);
    assert.equal(final.body.rentals[0].lateFeeCents, 20_000);
    assert.equal(final.body.rentals[0].finalPriceCents, rate.priceCents + 20_000);
    assert.equal(final.body.rentals[0].paymentMethod, 'cash');
    assert.equal(final.body.rentals[0].endedByName, 'Colaborador');
    assert.equal(final.body.equipment.filter((e) => e.busy).length, 0);
    await handle.db.execute(sql `
    UPDATE settings SET value = '0' WHERE key = 'lateFeePerMinuteCents'
  `);
    const adminData = await call('/api/v1/admin/data', 'GET', undefined, admin);
    const actions = adminData.body.audit.map((a) => a.action);
    assert.ok(actions.includes('crear_alquiler'));
    assert.ok(actions.includes('finalizar_alquiler'));
});
test('El outbox encola notificaciones en la misma transacción del alquiler', async () => {
    const data = await call('/api/v1/admin/notifications', 'GET', undefined, admin);
    const keys = data.body.map((n) => n.templateKey);
    assert.ok(keys.includes('rental.started'), 'debe encolar la confirmación de inicio');
    assert.ok(keys.includes('rental.due_soon'), 'debe programar el aviso de vencimiento');
    // Ninguna notificación comercial: las campañas son fase 2.
    assert.ok(data.body.every((n) => n.category !== 'marketing'));
});
test('CRUD de usuarios: roles, cambios de perfil, baja segura e historial', async () => {
    const created = await call('/api/v1/admin/users', 'POST', {
        name: 'Colaborador de prueba',
        email: 'collaborator@test.local',
        password: PASSWORD,
        role: 'collaborator',
    }, admin);
    assert.equal(created.status, 201);
    const userId = created.body.id;
    const duplicate = await call('/api/v1/admin/users', 'POST', {
        name: 'Duplicado',
        email: 'COLLABORATOR@test.local',
        password: PASSWORD,
        role: 'collaborator',
    }, admin);
    assert.equal(duplicate.status, 409);
    const updated = await call(`/api/v1/admin/users/${userId}`, 'PATCH', { name: 'Colaborador actualizado', email: 'colaborador@test.local' }, admin);
    assert.equal(updated.status, 200);
    const collaborator = await login('colaborador@test.local');
    const session = await call('/api/v1/auth/session', 'GET', undefined, collaborator);
    assert.equal(session.body.user.role, 'collaborator');
    assert.equal((await call(`/api/v1/admin/users/${userId}`, 'PATCH', { role: 'admin' }, collaborator)).status, 403);
    const promoted = await call(`/api/v1/admin/users/${userId}`, 'PATCH', { role: 'admin' }, admin);
    assert.equal(promoted.status, 200);
    assert.equal((await call('/api/v1/dashboard', 'GET', undefined, collaborator)).status, 401);
    const promotedSession = await login('colaborador@test.local');
    assert.equal((await call('/api/v1/auth/session', 'GET', undefined, promotedSession)).body.user.role, 'admin');
    assert.equal((await call(`/api/v1/admin/users/${userId}`, 'PATCH', { role: 'collaborator' }, promotedSession)).status, 400);
    const secondAdmin = await call('/api/v1/admin/users', 'POST', {
        name: 'Segundo administrador',
        email: 'second-admin@test.local',
        password: PASSWORD,
        role: 'admin',
    }, admin);
    assert.equal(secondAdmin.status, 201);
    const secondAdminSession = await login('second-admin@test.local');
    assert.equal((await call(`/api/v1/admin/users/${secondAdmin.body.id}`, 'PATCH', { role: 'collaborator' }, secondAdminSession)).status, 400);
    assert.equal((await call(`/api/v1/admin/users/${admin.id}`, 'DELETE', undefined, admin)).status, 400);
    assert.equal((await call(`/api/v1/admin/users/${worker.id}`, 'DELETE', undefined, admin)).status, 409);
    assert.equal((await call(`/api/v1/admin/users/${userId}`, 'PATCH', { role: 'collaborator' }, admin)).status, 200);
    assert.equal((await call('/api/v1/admin/data', 'GET', undefined, promotedSession)).status, 401);
    const collaboratorAgain = await login('colaborador@test.local');
    assert.equal((await call('/api/v1/admin/data', 'GET', undefined, collaboratorAgain)).status, 403);
    assert.equal((await call(`/api/v1/admin/users/${userId}`, 'PATCH', { active: false }, admin)).status, 200);
    assert.equal((await call('/api/v1/dashboard', 'GET', undefined, collaboratorAgain)).status, 401);
    assert.equal((await call(`/api/v1/admin/users/${userId}`, 'PATCH', { active: true }, admin)).status, 200);
    assert.equal((await call(`/api/v1/admin/users/${userId}`, 'DELETE', undefined, admin)).status, 200);
    assert.equal((await call(`/api/v1/admin/users/${userId}`, 'DELETE', undefined, admin)).status, 404);
    const finalAdminData = await call('/api/v1/admin/data', 'GET', undefined, admin);
    assert.ok(!finalAdminData.body.users.some((user) => user.id === userId));
    assert.ok(finalAdminData.body.audit.some((entry) => entry.action === 'eliminar_usuario'));
    assert.equal((await call(`/api/v1/admin/users/${secondAdmin.body.id}`, 'DELETE', undefined, admin)).status, 200);
});
test('Tarifas futuras, vencidas e inactivas quedan fuera; fechas validadas', async () => {
    for (const dates of [
        { validFrom: '2099-01-01', validUntil: null },
        { validFrom: null, validUntil: '2020-01-01' },
    ]) {
        const res = await call('/api/v1/admin/rates', 'POST', { period: 'special', minutes: 99, quantity: 1, priceCents: 4200, ...dates }, admin);
        assert.equal(res.status, 201);
    }
    const pub = await call('/api/v1/public');
    assert.ok(!pub.body.rates.some((r) => r.minutes === 99));
    const invalid = await call('/api/v1/admin/rates', 'POST', { period: 'special', minutes: 20, quantity: 1, priceCents: 4200, validFrom: '2026-02-30' }, admin);
    assert.equal(invalid.status, 400);
});
test('Una tarifa sin uso se borra; la que ya se aplicó solo se desactiva', async () => {
    const created = await call('/api/v1/admin/rates', 'POST', { period: 'special', minutes: 77, quantity: 1, priceCents: 7700, validFrom: null }, admin);
    assert.equal(created.status, 201);
    const before = await call('/api/v1/admin/data', 'GET', undefined, admin);
    const spare = before.body.rates.find((r) => r.minutes === 77);
    assert.ok(spare, 'la tarifa recién creada debe aparecer en administración');
    assert.equal((await call(`/api/v1/admin/rates/${spare.id}`, 'DELETE', undefined, admin)).status, 200);
    assert.equal((await call(`/api/v1/admin/rates/${spare.id}`, 'DELETE', undefined, admin)).status, 404);
    const after = await call('/api/v1/admin/data', 'GET', undefined, admin);
    assert.ok(!after.body.rates.some((r) => r.id === spare.id));
    assert.ok(after.body.audit.some((a) => a.action === 'eliminar_tarifa'));
    // La tarifa del alquiler del ciclo anterior está referenciada por `rentals`.
    const dash = await call('/api/v1/dashboard', 'GET', undefined, admin);
    const used = dash.body.rates.find((r) => r.quantity === 1);
    assert.equal((await call(`/api/v1/admin/rates/${used.id}`, 'DELETE', undefined, admin)).status, 409);
    // El trabajador nunca puede borrar tarifas.
    assert.equal((await call(`/api/v1/admin/rates/${used.id}`, 'DELETE', undefined, worker)).status, 403);
});
test('Parejas exigen dos patinetas y dos cascos; mantenimiento bloquea el alquiler', async () => {
    const dash = await call('/api/v1/dashboard', 'GET', undefined, admin);
    const pairRate = dash.body.rates.find((r) => r.quantity === 2);
    const scooters = dash.body.equipment
        .filter((e) => e.kind === 'scooter')
        .map((e) => e.id);
    const helmets = dash.body.equipment
        .filter((e) => e.kind === 'helmet')
        .map((e) => e.id);
    const base = {
        customer: { fullName: 'Pareja', document: '999', phone: null },
        rateId: pairRate.id,
        notes: '',
        ...CLOSING,
    };
    // Dos patinetas sin cascos: rechazado.
    const wrongMix = await call('/api/v1/rentals', 'POST', {
        ...base,
        requestId: '33333333-3333-4333-8333-333333333333',
        equipmentIds: [scooters[0], scooters[1]],
    }, admin);
    assert.equal(wrongMix.status, 400);
    await call(`/api/v1/admin/equipment/${scooters[0]}`, 'PATCH', { status: 'maintenance' }, admin);
    const blocked = await call('/api/v1/rentals', 'POST', {
        ...base,
        requestId: '44444444-4444-4444-8444-444444444444',
        equipmentIds: [scooters[0], scooters[1], helmets[0], helmets[1]],
    }, admin);
    assert.equal(blocked.status, 409);
    await call(`/api/v1/admin/equipment/${scooters[0]}`, 'PATCH', { status: 'available' }, admin);
    const ok = await call('/api/v1/rentals', 'POST', {
        ...base,
        requestId: '55555555-5555-4555-8555-555555555555',
        equipmentIds: [scooters[0], scooters[1], helmets[0], helmets[1]],
    }, admin);
    assert.equal(ok.status, 201);
    // Un equipo en alquiler no se puede poner en mantenimiento.
    const busy = await call(`/api/v1/admin/equipment/${scooters[0]}`, 'PATCH', { status: 'maintenance' }, admin);
    assert.equal(busy.status, 409);
});
test('Publicación de FAQ y revocación de sesión al desactivar usuario', async () => {
    const data = await call('/api/v1/admin/data', 'GET', undefined, admin);
    const faq = data.body.faqs[0];
    await call(`/api/v1/admin/faqs/${faq.id}`, 'PATCH', { question: faq.question, answer: faq.answer, position: faq.position, active: false }, admin);
    const pub = await call('/api/v1/public');
    assert.ok(!pub.body.faqs.some((f) => f.id === faq.id));
    await call(`/api/v1/admin/users/${worker.id}`, 'PATCH', { active: false }, admin);
    assert.equal((await call('/api/v1/dashboard', 'GET', undefined, worker)).status, 401);
    const relogin = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin: ORIGIN },
        payload: { email: 'worker@test.local', password: PASSWORD },
    });
    assert.equal(relogin.statusCode, 401);
});
test('El teléfono inválido se rechaza y el cliente queda normalizado en E.164', async () => {
    const dash = await call('/api/v1/dashboard', 'GET', undefined, admin);
    const rate = dash.body.rates.find((r) => r.quantity === 1);
    const free = dash.body.equipment.filter((e) => !e.busy && e.status === 'available');
    const scooter = free.find((e) => e.kind === 'scooter');
    const helmet = free.find((e) => e.kind === 'helmet');
    const bad = await call('/api/v1/rentals', 'POST', {
        requestId: '66666666-6666-4666-8666-666666666666',
        customer: { fullName: 'Sin formato', document: '777', phone: '3001112233' },
        rateId: rate.id,
        equipmentIds: [scooter.id, helmet.id],
        notes: '',
        ...CLOSING,
    }, admin);
    assert.equal(bad.status, 400);
});
test('Sin firma o sin aceptar los términos no se puede iniciar el alquiler', async () => {
    const dash = await call('/api/v1/dashboard', 'GET', undefined, admin);
    const rate = dash.body.rates.find((r) => r.quantity === 1);
    const free = dash.body.equipment.filter((e) => !e.busy && e.status === 'available');
    const scooter = free.find((e) => e.kind === 'scooter');
    const helmet = free.find((e) => e.kind === 'helmet');
    const base = {
        customer: { fullName: 'Sin firmar', document: '4321', phone: null },
        rateId: rate.id,
        equipmentIds: [scooter.id, helmet.id],
        notes: '',
    };
    const sinFirma = await call('/api/v1/rentals', 'POST', { ...base, requestId: '99999999-9999-4999-8999-999999999999', termsAccepted: true }, admin);
    assert.equal(sinFirma.status, 400);
    const sinAceptar = await call('/api/v1/rentals', 'POST', {
        ...base,
        requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        signature: SIGNATURE,
        termsAccepted: false,
    }, admin);
    assert.equal(sinAceptar.status, 400);
    // Un rechazo no puede dejar los equipos marcados como ocupados.
    const after = await call('/api/v1/dashboard', 'GET', undefined, admin);
    const stillFree = after.body.equipment.filter((e) => [scooter.id, helmet.id].includes(e.id) && !e.busy);
    assert.equal(stillFree.length, 2);
});
test('El tipo de documento usa cédula por defecto y distingue el mismo número', async () => {
    const dash = await call('/api/v1/dashboard', 'GET', undefined, admin);
    const rate = dash.body.rates.find((r) => r.quantity === 1);
    const free = dash.body.equipment.filter((e) => !e.busy && e.status === 'available');
    const scooter = free.find((e) => e.kind === 'scooter');
    const helmet = free.find((e) => e.kind === 'helmet');
    // Sin indicar el tipo, el contrato aplica 'CC'.
    const omitted = await call('/api/v1/rentals', 'POST', {
        requestId: '77777777-7777-4777-8777-777777777777',
        customer: { fullName: 'Cliente Cedula', document: '8080', phone: null },
        rateId: rate.id,
        equipmentIds: [scooter.id, helmet.id],
        notes: '',
        ...CLOSING,
    }, admin);
    assert.equal(omitted.status, 201);
    const listed = await call('/api/v1/rentals', 'GET', undefined, admin);
    const created = listed.body.find((r) => r.id === omitted.body.id);
    assert.equal(created.customerDocumentType, 'CC');
    // El mismo número con pasaporte es otra persona, no un conflicto.
    await call(`/api/v1/rentals/${String(omitted.body.id)}/finish`, 'POST', { paymentMethod: 'transfer', returnTime: timeInBogota(new Date(Date.now() + 60_000)) }, admin);
    const passport = await call('/api/v1/rentals', 'POST', {
        requestId: '88888888-8888-4888-8888-888888888888',
        customer: {
            fullName: 'Visitante Pasaporte',
            documentType: 'PA',
            document: '8080',
            phone: null,
        },
        rateId: rate.id,
        equipmentIds: [scooter.id, helmet.id],
        notes: '',
        ...CLOSING,
    }, admin);
    assert.equal(passport.status, 201);
    const after = await call('/api/v1/rentals', 'GET', undefined, admin);
    const second = after.body.find((r) => r.id === passport.body.id);
    assert.equal(second.customerDocumentType, 'PA');
    assert.notEqual(second.customerName, created.customerName);
});
test('El alquiler activo expone el vencimiento para el contador en vivo', async () => {
    const active = await call('/api/v1/rentals?status=active', 'GET', undefined, admin);
    for (const rental of active.body) {
        assert.ok(rental.dueAt, 'cada alquiler debe traer dueAt');
        const span = new Date(rental.dueAt).getTime() - new Date(rental.startedAt).getTime();
        const snapshot = await handle.db.execute(sql `select preparation_minutes from rentals where id = ${rental.id}`);
        assert.equal(span, (rental.minutes + Number(snapshot.rows[0].preparation_minutes)) * 60_000, 'dueAt incluye la preparación guardada y la duración contratada');
    }
});
test('Solo administración elimina alquileres; el equipo vuelve a quedar libre', async () => {
    const dash = await call('/api/v1/dashboard', 'GET', undefined, admin);
    const rate = dash.body.rates.find((r) => r.quantity === 1);
    const free = dash.body.equipment.filter((e) => !e.busy && e.status === 'available');
    const scooter = free.find((e) => e.kind === 'scooter');
    const helmet = free.find((e) => e.kind === 'helmet');
    const created = await call('/api/v1/rentals', 'POST', {
        requestId: '99999999-9999-4999-8999-999999999999',
        customer: { fullName: 'Registro de prueba', document: '5150', phone: null },
        rateId: rate.id,
        equipmentIds: [scooter.id, helmet.id],
        notes: '',
        ...CLOSING,
    }, admin);
    assert.equal(created.status, 201);
    const id = String(created.body.id);
    // Sesión propia: las pruebas anteriores revocan la del colaborador compartido.
    await call('/api/v1/admin/users', 'POST', {
        name: 'Colaborador borrado',
        email: 'borrado@test.local',
        password: PASSWORD,
        role: 'collaborator',
    }, admin);
    const collaborator = await login('borrado@test.local');
    const denied = await call(`/api/v1/admin/rentals/${id}`, 'DELETE', undefined, collaborator);
    assert.equal(denied.status, 403, 'un colaborador no puede borrar registros');
    for (const body of [
        undefined,
        { reason: '   ' },
        { reason: 'corto' },
        { reason: 'x'.repeat(1001) },
    ]) {
        assert.equal((await call(`/api/v1/admin/rentals/${id}`, 'DELETE', body, admin)).status, 400);
    }
    const reason = 'Registro duplicado durante una prueba';
    const removed = await call(`/api/v1/admin/rentals/${id}`, 'DELETE', { reason }, admin);
    assert.equal(removed.status, 200);
    assert.equal((await call(`/api/v1/admin/rentals/${id}`, 'DELETE', { reason }, admin)).status, 404, 'borrar dos veces no debe tener efecto');
    const after = await call('/api/v1/dashboard', 'GET', undefined, admin);
    assert.ok(!after.body.rentals.some((r) => String(r.id) === id));
    // El cascade de rental_equipment libera los equipos sin tocarlos a mano.
    const released = after.body.equipment.filter((e) => (e.id === scooter.id || e.id === helmet.id) && !e.busy);
    assert.equal(released.length, 2);
    const adminData = await call('/api/v1/admin/data', 'GET', undefined, admin);
    const actions = adminData.body.audit.map((a) => a.action);
    assert.equal(adminData.body.audit.find((entry) => entry.action === 'eliminar_alquiler' && entry.entityId === id)?.reason, reason);
    assert.ok(actions.includes('eliminar_alquiler'), 'el borrado debe quedar en la auditoría');
});
test('cierres: solo administradores, fecha única, edición auditada y conflicto de versión', async () => {
    worker = await login('borrado@test.local');
    const body = {
        date: '2020-02-29',
        opensAt: '08:00',
        closesAt: '22:00',
        closesNextDay: false,
        cashCents: 10000,
        transferCents: 5000,
        expenses: [{ description: 'Transporte', amountCents: 2000 }],
        notes: '',
    };
    const path = '/api/v1/admin/day-closings';
    assert.equal((await call(path)).status, 401);
    assert.equal((await call(path, 'GET', undefined, worker)).status, 403);
    assert.equal((await call(path, 'POST', body, worker)).status, 403);
    assert.equal((await call(`${path}/${body.date}`, 'PUT', { ...body, version: 1 }, worker)).status, 403);
    const created = await call(path, 'POST', body, admin);
    assert.equal(created.status, 201);
    assert.equal(created.body.version, 1);
    assert.equal((await call(path, 'POST', body, admin)).status, 409);
    const changed = await call(`${path}/${body.date}`, 'PUT', { ...body, version: 1, cashCents: 20000 }, admin);
    assert.equal(changed.status, 200);
    assert.equal(changed.body.version, 2);
    assert.equal((await call(`${path}/${body.date}`, 'PUT', { ...body, version: 1 }, admin)).status, 409);
    assert.equal((await call(`${path}/${body.date}`, 'PUT', { ...body, version: 2, date: '2020-03-01' }, admin))
        .status, 400);
    const list = await call(path, 'GET', undefined, admin);
    assert.equal(list.body.filter((row) => row.date === body.date).length, 1);
    const audit = await handle.db.execute(sql `select action from audit_log where entity = 'day_closing'`);
    assert.deepEqual(audit.rows.map((row) => row.action).sort(), [
        'day_closing.create',
        'day_closing.update',
    ]);
});
test('seguimiento: idempotente, público mínimo, actualización y revocación', async () => {
    worker = await login('borrado@test.local');
    const schema = await import('@rokai/db');
    const { eq } = await import('drizzle-orm');
    const [rate] = await handle.db
        .insert(schema.rates)
        .values({ period: 'special', minutes: 30, quantity: 1, priceCents: 10000 })
        .returning();
    const gear = await handle.db
        .insert(schema.equipment)
        .values([
        { code: 'TRACK-TEST-S', kind: 'scooter' },
        { code: 'TRACK-TEST-H', kind: 'helmet' },
    ])
        .returning();
    const payload = {
        requestId: crypto.randomUUID(),
        customer: { fullName: 'Privado', documentType: 'CC', document: 'tracking-test', phone: null },
        rateId: rate.id,
        equipmentIds: gear.map((e) => e.id),
        notes: 'Privado',
        ...CLOSING,
    };
    const [first, retry] = await Promise.all([
        call('/api/v1/rentals', 'POST', payload, admin),
        call('/api/v1/rentals', 'POST', payload, admin),
    ]);
    assert.ok([200, 201].includes(first.status));
    assert.ok([200, 201].includes(retry.status));
    assert.equal(first.body.trackingPath, retry.body.trackingPath);
    const rentalId = first.body.id;
    const token = first.body.trackingPath.split('/').pop();
    assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    const path = `/api/v1/tracking/${token}`;
    const result = await call(path);
    assert.equal(result.status, 200);
    assert.deepEqual(Object.keys(result.body).sort(), [
        'status',
        'remainingSeconds',
        'serverNow',
        'preparationEndsAt',
        'startedAt',
        'dueAt',
        'minutes',
        'scooterCount',
        'whatsapp',
    ].sort());
    assert.equal(result.body.scooterCount, 1);
    assert.equal(Date.parse(result.body.dueAt) - Date.parse(result.body.preparationEndsAt), result.body.minutes * 60_000);
    assert.ok(Date.parse(result.body.preparationEndsAt) >= Date.parse(result.body.startedAt));
    await handle.db
        .update(schema.rentals)
        .set({ dueAt: new Date(Date.now() + 3600000), minutes: 60 })
        .where(eq(schema.rentals.id, rentalId));
    assert.ok((await call(path)).body.remainingSeconds > 3500);
    assert.equal((await call(`/api/v1/rentals/${rentalId}/tracking`, 'GET', undefined, worker)).body.path, first.body.trackingPath);
    assert.equal((await call(`/api/v1/rentals/${rentalId}/finish`, 'POST', {
        notes: '',
        paymentMethod: 'cash',
        returnTime: timeInBogota(new Date(Date.now() + 60_000)),
    }, admin)).status, 200);
    const closed = await call(path);
    assert.equal(closed.body.status, 'closed');
    assert.equal(closed.body.remainingSeconds, 0);
    assert.equal((await call(`/api/v1/admin/rentals/${rentalId}/tracking/revoke`, 'POST', {}, worker)).status, 403);
    assert.equal((await call(`/api/v1/admin/rentals/${rentalId}/tracking/revoke`, 'POST', {}, admin)).status, 200);
    assert.equal((await call(path)).status, 404);
    assert.equal((await call('/api/v1/tracking/invalid')).status, 404);
});
test('gastos del negocio: permisos, cierre sin duplicados, idempotencia, edición y anulación', async () => {
    const path = '/api/v1/admin/business-expenses';
    const expense = {
        requestId: crypto.randomUUID(),
        date: '2019-01-15',
        category: 'salary',
        description: 'Pago del personal',
        amountCents: 3000,
        paymentMethod: 'cash',
        beneficiary: 'Equipo',
        receiptUrl: '',
    };
    assert.equal((await call(path)).status, 401);
    await call('/api/v1/admin/users', 'POST', {
        name: 'Gastos colaborador',
        email: 'expenses@test.local',
        password: PASSWORD,
        role: 'collaborator',
    }, admin);
    const collaborator = await login('expenses@test.local');
    for (const [route, method, body] of [
        [path, 'GET', undefined],
        [path, 'POST', expense],
        [path + '/1', 'PUT', { ...expense, version: 1 }],
        [path + '/1/void', 'POST', { version: 1, reason: 'Registro duplicado' }],
    ])
        assert.equal((await call(route, method, body, collaborator)).status, 403);
    const closing = {
        date: expense.date,
        opensAt: '08:00',
        closesAt: '20:00',
        cashCents: 10000,
        transferCents: 5000,
        expenses: [{ description: 'Transporte', amountCents: 2000 }],
        notes: '',
    };
    assert.equal((await call('/api/v1/admin/day-closings', 'POST', closing, admin)).status, 201);
    const concurrent = await Promise.all([
        call(path, 'POST', expense, admin),
        call(path, 'POST', expense, admin),
    ]);
    assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 201]);
    const id = concurrent[0].body.id;
    const query = `${path}?from=${expense.date}&to=${expense.date}`;
    let result = await call(query, 'GET', undefined, admin);
    assert.equal(result.status, 200);
    assert.equal(result.body.total, 2);
    assert.deepEqual(result.body.summary, {
        cashCents: 10000,
        transferCents: 5000,
        closingExpensesCents: 2000,
        additionalExpensesCents: 3000,
        netCents: 10000,
        cashBalanceCents: 5000,
        transferBalanceCents: 5000,
    });
    assert.equal(result.body.monthly[0].expensesCents, 5000);
    assert.equal((await call(query + '&category=salary', 'GET', undefined, admin)).body.total, 1);
    assert.equal((await call(path, 'POST', { ...expense, amountCents: 0 }, admin)).status, 400);
    assert.equal((await call(path, 'POST', { ...expense, amountCents: 1 }, admin)).status, 400);
    assert.equal((await call(path + '/' + id, 'PUT', { ...expense, version: 1, amountCents: 4000 }, admin))
        .status, 200);
    assert.equal((await call(path + '/' + id, 'PUT', { ...expense, version: 1 }, admin)).status, 409);
    assert.equal((await call(path + '/' + id + '/void', 'POST', { version: 2, reason: ' ' }, admin)).status, 400);
    assert.equal((await call(path + '/' + id + '/void', 'POST', { version: 2, reason: 'Pago registrado dos veces' }, admin)).status, 200);
    assert.equal((await call(path + '/' + id, 'PUT', { ...expense, version: 3 }, admin)).status, 409);
    result = await call(query, 'GET', undefined, admin);
    assert.equal(result.body.total, 1);
    assert.equal(result.body.summary.netCents, 13000);
    assert.equal(result.body.summary.cashBalanceCents, 8000);
    assert.equal(result.body.summary.transferBalanceCents, 5000);
    const changed = await call('/api/v1/admin/day-closings/' + closing.date, 'PUT', {
        ...closing,
        version: 1,
        expenses: [{ description: 'Transporte', amountCents: 2000, paymentMethod: 'transfer' }],
    }, admin);
    assert.equal(changed.status, 200);
    result = await call(query, 'GET', undefined, admin);
    assert.equal(result.body.summary.cashBalanceCents, 10000);
    assert.equal(result.body.summary.transferBalanceCents, 3000);
    assert.equal(result.body.summary.netCents, 13000);
    assert.equal((await call(query + '&status=voided', 'GET', undefined, admin)).body.total, 1);
    const audit = await call('/api/v1/admin/data', 'GET', undefined, admin);
    assert.equal(audit.body.audit.find((a) => a.action === 'business_expense.void' && a.entityId === String(id)).reason, 'Pago registrado dos veces');
});
test('reservas: horario, catálogo, idempotencia, cupo concurrente, gestión y alquiler', async () => {
    const today = bogotaDate(new Date());
    let date = addDays(today, 3);
    while (!ratePeriodForDate(date))
        date = addDays(date, 1);
    let closed = addDays(today, 1);
    while (ratePeriodForDate(closed))
        closed = addDays(closed, 1);
    const publicPath = '/api/v1/public/reservations';
    const options = await call(`${publicPath}/options`);
    assert.equal(options.status, 200);
    assert.equal(options.body.whatsapp, '+573103700290');
    assert.equal(options.body.rules.slotMinutes, 15);
    const avail = await call(`${publicPath}/availability?date=${date}&quantity=1`);
    assert.equal(avail.status, 200);
    assert.equal(avail.body.period, ratePeriodForDate(date));
    // Mismo catálogo que la sección de tarifas: sin precios propios de reservas.
    const catalog = (await call('/api/v1/public')).body.rates;
    for (const plan of avail.body.plans) {
        const rate = catalog.find((r) => r.id === plan.rateId);
        assert.equal(rate.period, avail.body.period);
        assert.equal(rate.quantity, 1);
        assert.equal(rate.priceCents, plan.priceCents);
    }
    const half = avail.body.plans.find((p) => p.minutes === 30);
    const hour = avail.body.plans.find((p) => p.minutes === 60);
    assert.equal(half.slots[0].start, '16:00');
    assert.equal(half.slots.at(-1).start, '21:00');
    assert.equal(hour.slots.at(-1).end, '22:00');
    const pairs = (await call(`${publicPath}/availability?date=${date}&quantity=2`)).body;
    assert.ok(pairs.plans.every((p) => p.quantity === 2));
    assert.ok((await call(`${publicPath}/availability?date=${closed}&quantity=1`)).body.closedReason);
    assert.equal((await call(publicPath)).status, 404);
    const body = (overrides = {}) => ({
        requestId: crypto.randomUUID(),
        customerName: 'Cliente Reserva',
        phone: '+573001234567',
        date,
        startTime: '16:00',
        quantity: 1,
        rateId: half.rateId,
        ...overrides,
    });
    // Reglas de horario, también en el servidor.
    for (const invalid of [
        { startTime: '15:45' },
        { startTime: '21:15' },
        { startTime: '21:15', rateId: hour.rateId },
        { date: addDays(today, -1) },
        { date: closed },
        { quantity: 2 },
    ]) {
        assert.equal((await call(publicPath, 'POST', body(invalid))).status, 400, JSON.stringify(invalid));
    }
    // El precio enviado por el navegador se ignora; manda el catálogo.
    const request = body({ priceCents: 1 });
    const created = await call(publicPath, 'POST', request);
    assert.equal(created.status, 201);
    assert.equal(created.body.priceCents, half.priceCents);
    assert.match(created.body.code, /^RK-[2-9A-Z]{6}$/);
    assert.equal(created.body.endTime, '16:30');
    assert.equal(created.body.status, 'pending');
    const text = new URL(created.body.whatsappUrl).searchParams.get('text') ?? '';
    assert.ok(created.body.whatsappUrl.startsWith('https://wa.me/573103700290?text='));
    assert.match(text, new RegExp(`Código: ${created.body.code}`));
    // Doble clic o reintento: la misma reserva, nunca dos.
    const retry = await call(publicPath, 'POST', request);
    assert.equal(retry.status, 200);
    assert.equal(retry.body.code, created.body.code);
    assert.equal((await call(publicPath, 'POST', { ...request, startTime: '17:00' })).status, 409);
    // Capacidad: N confirmaciones simultáneas nunca superan la flota habilitada.
    const dash = await call('/api/v1/dashboard', 'GET', undefined, admin);
    const ready = (kind) => dash.body.equipment.filter((e) => e.kind === kind && e.status === 'available').length;
    const capacity = Math.min(ready('scooter'), ready('helmet'));
    assert.ok(capacity >= 2);
    const burst = await Promise.all(Array.from({ length: capacity + 3 }, (_, i) => call(publicPath, 'POST', body({ startTime: '18:00', phone: `+5730012300${String(10 + i)}` }))));
    const accepted = burst.filter((r) => r.status === 201);
    assert.equal(accepted.length, capacity);
    assert.ok(burst.filter((r) => r.status !== 201).every((r) => r.status === 409));
    const full = (await call(`${publicPath}/availability?date=${date}&quantity=1`)).body;
    const slot = (p, s) => p.slots.find((x) => x.start === s);
    const fullHalf = full.plans.find((p) => p.minutes === 30);
    assert.equal(slot(fullHalf, '18:00').available, false);
    // Un intervalo contiguo no se solapa: 17:30-18:00 sigue libre.
    assert.equal(slot(fullHalf, '17:30').available, true);
    assert.equal((await call(publicPath, 'POST', body({ startTime: '17:45' }))).status, 409);
    // Gestión: protegida y sin listado público.
    assert.equal((await call('/api/v1/reservations')).status, 401);
    assert.equal((await call('/api/v1/reservations/1')).status, 401);
    const listed = await call(`/api/v1/reservations?date=${date}&status=pending&sort=created_desc`, 'GET', undefined, admin);
    assert.equal(listed.status, 200);
    assert.equal(listed.body.total, capacity + 1);
    const search = await call(`/api/v1/reservations?search=${created.body.code}`, 'GET', undefined, admin);
    assert.equal(search.body.total, 1);
    const own = search.body.items[0];
    assert.equal(own.startTime, '16:00');
    assert.equal(own.endTime, '16:30');
    assert.equal((await call(`/api/v1/reservations?search=3001234567`, 'GET', undefined, admin)).body.total, 1);
    // Confirmar al recibir el WhatsApp: sin motivo, una sola vez y con autor.
    const confirmPath = `/api/v1/reservations/${String(own.id)}/status`;
    assert.equal((await call(confirmPath, 'POST', { status: 'confirmed' }, admin)).status, 200);
    assert.equal((await call(confirmPath, 'POST', { status: 'confirmed' }, admin)).status, 409);
    const confirmed = await call(`/api/v1/reservations/${String(own.id)}`, 'GET', undefined, admin);
    assert.equal(confirmed.body.status, 'confirmed');
    assert.equal(confirmed.body.statusChangedByName, 'Admin');
    // Confirmada sigue ocupando cupo: no se libera el de las 16:00.
    const afterConfirm = (await call(`${publicPath}/availability?date=${date}&quantity=1`)).body;
    assert.equal(afterConfirm.plans
        .find((p) => p.minutes === 30)
        .slots.find((s) => s.start === '18:00').available, false);
    // Cancelar libera el cupo.
    const burstCodes = accepted.map((r) => r.body.code);
    const victim = (await call(`/api/v1/reservations?search=${burstCodes[0]}`, 'GET', undefined, admin)).body.items[0];
    const statusPath = `/api/v1/reservations/${String(victim.id)}/status`;
    assert.equal((await call(statusPath, 'POST', { status: 'cancelled', reason: 'no' }, admin)).status, 400);
    assert.equal((await call(statusPath, 'POST', { status: 'cancelled', reason: 'Cliente cambió de plan' }, admin)).status, 200);
    assert.equal((await call(statusPath, 'POST', { status: 'no_show', reason: 'Segundo cambio' }, admin)).status, 409);
    const detail = await call(`/api/v1/reservations/${String(victim.id)}`, 'GET', undefined, admin);
    assert.equal(detail.body.status, 'cancelled');
    assert.equal(detail.body.statusReason, 'Cliente cambió de plan');
    assert.equal(detail.body.statusChangedByName, 'Admin');
    assert.equal((await call(publicPath, 'POST', body({ startTime: '18:00' }))).status, 201);
    // Iniciar alquiler desde la reserva: precio reservado, vínculo único y sin doble cupo.
    const free = (kind) => dash.body.equipment.find((e) => e.kind === kind && e.status === 'available' && !e.busy).id;
    const rentalBody = (requestId) => ({
        requestId,
        reservationId: own.id,
        customer: { fullName: own.customerName, document: 'RES-001', phone: own.phone },
        rateId: own.rateId,
        equipmentIds: [free('scooter'), free('helmet')],
        notes: `Reserva ${own.code}`,
        ...CLOSING,
    });
    await call(`/api/v1/admin/rates/${String(own.rateId)}`, 'PATCH', { priceCents: 7_777_700, active: true, validFrom: null, validUntil: null }, admin);
    const rental = await call('/api/v1/rentals', 'POST', rentalBody(crypto.randomUUID()), admin);
    assert.equal(rental.status, 201);
    const linked = await call(`/api/v1/reservations/${String(own.id)}`, 'GET', undefined, admin);
    assert.equal(linked.body.status, 'in_rental');
    assert.equal(linked.body.rentalId, rental.body.id);
    const rentals = (await call('/api/v1/dashboard', 'GET', undefined, admin)).body.rentals;
    const started = rentals.find((r) => r.id === rental.body.id);
    assert.equal(started.priceCents, own.priceCents);
    assert.equal(started.finalPriceCents, null);
    assert.equal(started.paymentMethod, null);
    assert.equal((await call('/api/v1/rentals', 'POST', rentalBody(crypto.randomUUID()), admin)).status, 409);
    // Al devolver el equipo la reserva queda completada.
    const now = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Bogota',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).format(new Date(Date.now() + 60_000));
    assert.equal((await call(`/api/v1/rentals/${String(rental.body.id)}/finish`, 'POST', { paymentMethod: 'cash', returnTime: now }, admin)).status, 200);
    assert.equal((await call(`/api/v1/reservations/${String(own.id)}`, 'GET', undefined, admin)).body.status, 'completed');
    // El horario de reservas se ajusta desde Administración y se valida su coherencia.
    const current = (await call('/api/v1/public')).body.settings;
    const withHours = (open, last, close) => ({
        ...current,
        reservationOpenTime: open,
        reservationLastStartTime: last,
        reservationCloseTime: close,
    });
    const settingsPath = '/api/v1/admin/settings';
    assert.equal((await call(settingsPath, 'PUT', withHours('17:00', '20:00', '21:00'))).status, 401);
    assert.equal((await call(settingsPath, 'PUT', withHours('20:00', '19:00', '21:00'), admin)).status, 400);
    assert.equal((await call(settingsPath, 'PUT', withHours('17:00', '21:00', '21:00'), admin)).status, 400);
    assert.equal((await call(settingsPath, 'PUT', withHours('17:00', '20:00', '21:00'), admin)).status, 200);
    const adjusted = (await call(`${publicPath}/options`)).body.rules;
    assert.deepEqual([adjusted.openTime, adjusted.lastStartTime, adjusted.closeTime], ['17:00', '20:00', '21:00']);
    const hourPlan = (await call(`${publicPath}/availability?date=${date}&quantity=1`)).body.plans.find((p) => p.minutes === 60);
    assert.equal(hourPlan.slots[0].start, '17:00');
    assert.equal(hourPlan.slots.at(-1).start, '20:00');
    assert.equal((await call(publicPath, 'POST', body({ startTime: '16:30' }))).status, 400);
    await call(settingsPath, 'PUT', withHours('16:00', '21:00', '22:00'), admin);
    // Eliminar reservas: solo administración, con justificación y rastro en auditoría.
    const created2 = await call('/api/v1/admin/users', 'POST', {
        name: 'Colaborador reservas',
        email: 'reservas-colab@test.local',
        password: PASSWORD,
        role: 'collaborator',
    }, admin);
    assert.equal(created2.status, 201);
    const collaborator = await login('reservas-colab@test.local');
    const deletePath = `/api/v1/admin/reservations/${String(victim.id)}`;
    const reason = { reason: 'Registro de prueba duplicado' };
    assert.equal((await call(deletePath, 'DELETE', reason)).status, 401);
    assert.equal((await call(deletePath, 'DELETE', reason, collaborator)).status, 403);
    assert.equal((await call(deletePath, 'DELETE', { reason: 'corto' }, admin)).status, 400);
    assert.equal((await call(deletePath, 'DELETE', reason, admin)).status, 200);
    assert.equal((await call(`/api/v1/reservations/${String(victim.id)}`, 'GET', undefined, admin)).status, 404);
    assert.equal((await call(deletePath, 'DELETE', reason, admin)).status, 404);
    const trail = (await call('/api/v1/admin/data', 'GET', undefined, admin)).body.audit.find((a) => a.action === 'reservation.delete' && a.entityId === String(victim.id));
    assert.ok(trail);
    // Una reserva con alquiler vinculado se puede borrar sin tocar el alquiler.
    assert.equal((await call(`/api/v1/admin/reservations/${String(own.id)}`, 'DELETE', reason, admin)).status, 200);
    const stillThere = (await call('/api/v1/dashboard', 'GET', undefined, admin)).body.rentals.find((r) => r.id === rental.body.id);
    assert.ok(stillThere);
});
test('grupos: precios 1–4, cupo concurrente, conversión con snapshot y asignación única', async () => {
    // Aislar la flota de operaciones de otros casos sin cambiar sus importes históricos.
    await handle.db.execute(sql `update rentals set ended_at = now() where ended_at is null`);
    await handle.db.execute(sql `update reservations set status = 'cancelled' where status in ('pending','confirmed')`);
    await handle.db.execute(sql `update equipment set status = 'available'`);
    await handle.db.execute(sql `update rates set active = true, valid_from = null, valid_until = null`);
    const dash = (await call('/api/v1/dashboard', 'GET', undefined, admin)).body;
    const equipment = (kind) => dash.equipment.filter((e) => e.kind === kind).map((e) => e.id);
    const scooters = equipment('scooter');
    const helmets = equipment('helmet');
    const capacity = Math.min(scooters.length, helmets.length);
    assert.ok(capacity >= 4);
    const pair = dash.rates.find((r) => r.quantity === 2 && r.minutes === 30);
    const single = dash.rates.find((r) => r.quantity === 1 && r.minutes === pair.minutes && r.period === pair.period);
    const expected = (quantity) => Math.floor(quantity / 2) * pair.priceCents + (quantity % 2) * single.priceCents;
    const rentalInput = (quantity, extra = {}) => ({
        requestId: crypto.randomUUID(),
        customer: { fullName: 'Grupo de prueba', document: 'GROUP-TEST' },
        quantity,
        rateId: quantity === 1 ? single.id : pair.id,
        equipmentIds: [...scooters.slice(0, quantity), ...helmets.slice(0, quantity)],
        ...CLOSING,
        ...extra,
    });
    for (const quantity of [1, 2, 3, 4]) {
        const result = await call('/api/v1/rentals', 'POST', rentalInput(quantity, { priceCents: 1 }), admin);
        assert.equal(result.status, 201, JSON.stringify(result.body));
        const stored = (await call('/api/v1/rentals', 'GET', undefined, admin)).body.find((r) => r.id === result.body.id);
        assert.equal(stored.priceCents, expected(quantity));
        assert.equal(stored.equipment.length, quantity * 2);
        assert.equal((await call('/api/v1/rentals', 'POST', rentalInput(quantity), admin)).status, 409);
        await handle.db.execute(sql `update rentals set ended_at = now() where id = ${result.body.id}`);
    }
    const concurrent = await Promise.all([
        call('/api/v1/rentals', 'POST', rentalInput(3), admin),
        call('/api/v1/rentals', 'POST', rentalInput(3), admin),
    ]);
    assert.deepEqual(concurrent.map((r) => r.status).sort(), [201, 409]);
    const winner = concurrent.find((r) => r.status === 201);
    await handle.db.execute(sql `update rentals set ended_at = now() where id = ${winner.body.id}`);
    for (const quantity of [0, 5, 1.5, '3']) {
        assert.equal((await call('/api/v1/rentals', 'POST', rentalInput(1, { quantity }), admin)).status, 400);
    }
    // Equipos distintos no evaden la capacidad reservada para el intervalo completo.
    const now = new Date();
    const today = bogotaDate(now);
    await handle.db.execute(sql `insert into reservations
    (code, request_id, customer_name, phone_e164, service_date, starts_at, ends_at, quantity, rate_id, rate_period, duration_minutes, price_cents, plan_label, status)
    values ('RK-GROUP1', ${crypto.randomUUID()}, 'Cupo prueba', '+573001234567', ${today}, ${new Date(now.getTime() + 5 * 60000)}, ${new Date(now.getTime() + 60 * 60000)}, ${Math.min(4, capacity)}, ${pair.id}, ${pair.period}, 30, ${pair.priceCents}, 'Grupo', 'confirmed')`);
    const blockedQuantity = Math.min(4, capacity);
    if (capacity < blockedQuantity * 2) {
        assert.equal((await call('/api/v1/rentals', 'POST', rentalInput(blockedQuantity), admin)).status, 409);
    }
    await handle.db.execute(sql `update reservations set status = 'cancelled' where code = 'RK-GROUP1'`);
    let date = addDays(today, 5);
    while (!ratePeriodForDate(date))
        date = addDays(date, 1);
    const path = '/api/v1/public/reservations';
    const plans = {};
    for (const quantity of [1, 2, 3, 4]) {
        const response = await call(`${path}/availability?date=${date}&quantity=${quantity}`);
        assert.equal(response.status, 200);
        plans[quantity] = response.body.plans.find((p) => p.minutes === 30);
        assert.ok(plans[quantity]);
    }
    assert.equal(plans[3].priceCents, plans[2].priceCents + plans[1].priceCents);
    assert.equal(plans[4].priceCents, plans[2].priceCents * 2);
    for (const quantity of [0, 5, 1.5])
        assert.equal((await call(`${path}/availability?date=${date}&quantity=${quantity}`)).status, 400);
    const reservationInput = (quantity, startTime = '16:00') => ({
        requestId: crypto.randomUUID(),
        customerName: 'Reserva grupo',
        phone: '+573001234567',
        date,
        startTime,
        quantity,
        rateId: plans[quantity].rateId,
    });
    for (const quantity of [1, 2, 3, 4]) {
        const result = await call(path, 'POST', reservationInput(quantity, `${15 + quantity}:00`));
        assert.equal(result.status, 201, JSON.stringify(result.body));
        assert.equal(result.body.quantity, quantity);
        assert.equal(result.body.priceCents, plans[quantity].priceCents);
        assert.equal(result.body.status, 'pending');
        if (quantity >= 3)
            assert.match(decodeURIComponent(result.body.whatsappUrl), quantity === 3 ? /1 plan de pareja \+ 1 individual/ : /2 planes de pareja/);
    }
    // Si falta el individual de esa categoría/duración, 3 se rechaza y 4 sigue cotizando.
    await handle.db.execute(sql `update rates set active = false where quantity = 1 and minutes = 30 and period = ${ratePeriodForDate(date)}`);
    const missingIndividual = await call(`${path}/availability?date=${date}&quantity=3`);
    assert.ok(!missingIndividual.body.plans.some((p) => p.minutes === 30));
    assert.equal((await call(path, 'POST', reservationInput(3, '21:00'))).status, 400);
    assert.ok((await call(`${path}/availability?date=${date}&quantity=4`)).body.plans.some((p) => p.minutes === 30));
    await handle.db.execute(sql `update rates set active = true where quantity = 1 and minutes = 30 and period = ${ratePeriodForDate(date)}`);
    const burst = await Promise.all(Array.from({ length: capacity }, () => call(path, 'POST', reservationInput(3, '20:00'))));
    assert.equal(burst.filter((r) => r.status === 201).length, Math.floor(capacity / 3));
    assert.ok(burst.every((r) => r.status === 201 || r.status === 409));
    const group = (await call(`/api/v1/reservations?date=${date}`, 'GET', undefined, admin)).body.items.find((r) => r.quantity === 4);
    assert.ok(group);
    assert.equal((await call(`/api/v1/admin/rates/${group.rateId}`, 'DELETE', undefined, admin)).status, 409);
    // Confirmación excluye el cupo propio, pero comprueba la flota actual.
    await handle.db.execute(sql `update equipment set status = 'maintenance' where kind = 'scooter'`);
    assert.equal((await call(`/api/v1/reservations/${group.id}/status`, 'POST', { status: 'confirmed' }, admin))
        .status, 409);
    await handle.db.execute(sql `update equipment set status = 'available'`);
    assert.equal((await call(`/api/v1/reservations/${group.id}/status`, 'POST', { status: 'confirmed' }, admin))
        .status, 200);
    await handle.db.execute(sql `update rates set active = false, price_cents = price_cents + 12345 where id = ${group.rateId}`);
    const input = rentalInput(4, { rateId: group.rateId, reservationId: group.id });
    const converted = await call('/api/v1/rentals', 'POST', input, admin);
    assert.equal(converted.status, 201, JSON.stringify(converted.body));
    const retry = await call('/api/v1/rentals', 'POST', input, admin);
    assert.equal(retry.status, 200);
    assert.equal(retry.body.id, converted.body.id);
    assert.equal((await call('/api/v1/rentals', 'POST', { ...input, requestId: crypto.randomUUID() }, admin))
        .status, 409);
    const stored = (await call('/api/v1/rentals', 'GET', undefined, admin)).body.find((r) => r.id === converted.body.id);
    assert.equal(stored.priceCents, group.priceCents);
    assert.equal(stored.minutes, group.durationMinutes);
    assert.equal(stored.equipment.length, 8);
    // Reservas históricas cuya referencia fue borrada: tarifa compatible, mismo snapshot.
    await handle.db.execute(sql `update rentals set ended_at = now() where id = ${converted.body.id}`);
    const old = (await call(`/api/v1/reservations?date=${date}`, 'GET', undefined, admin)).body.items.find((r) => r.quantity === 3);
    await handle.db.execute(sql `update reservations set rate_id = null where id = ${old.id}`);
    await handle.db.execute(sql `update rates set active = true where id = ${old.rateId}`);
    const recovered = await call('/api/v1/rentals', 'POST', rentalInput(3, { rateId: old.rateId, reservationId: old.id }), admin);
    assert.equal(recovered.status, 201, JSON.stringify(recovered.body));
    const recoveredRental = (await call('/api/v1/rentals', 'GET', undefined, admin)).body.find((r) => r.id === recovered.body.id);
    assert.equal(recoveredRental.priceCents, old.priceCents);
    assert.equal(recoveredRental.minutes, old.durationMinutes);
});
test('sesión: vencimiento autoritativo, respuesta sin caché y rechazo tras expirar', async () => {
    const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { origin: ORIGIN },
        payload: { email: 'admin@test.local', password: PASSWORD },
    });
    assert.equal(response.statusCode, 200);
    const data = response.json();
    assert.ok(Date.parse(data.expiresAt) > Date.parse(data.serverNow));
    const cookie = `rokai_session=${response.cookies.find((item) => item.name === 'rokai_session').value}`;
    const session = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/session',
        headers: { cookie },
    });
    assert.equal(session.headers['cache-control'], 'no-store');
    assert.equal(session.json().expiresAt, data.expiresAt);
    await handle.db.execute(sql `update sessions set expires_at = now() - interval '1 second' where csrf_token = ${data.csrf}`);
    const expired = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/session',
        headers: { cookie },
    });
    assert.equal(expired.json().user, null);
    assert.equal(expired.json().expiresAt, null);
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/dashboard', headers: { cookie } })).statusCode, 401);
    const dashboard = await app.inject({
        method: 'GET',
        url: '/api/v1/dashboard',
        headers: { cookie: admin.cookie },
    });
    assert.equal(dashboard.statusCode, 200);
    assert.equal(dashboard.headers['cache-control'], 'no-store');
    assert.equal(dashboard.json().completedTrips.date, bogotaDate(new Date()));
    assert.ok(Number.isFinite(Date.parse(dashboard.json().updatedAt)));
});
test('viajes completados: fecha Bogotá, más de 200, grupos, activos y cierre de jornada', async () => {
    const { completedTrips } = await import('./services/dashboard.js');
    const schema = await import('@rokai/db');
    const { eq } = await import('drizzle-orm');
    const rollback = new Error('rollback de fixtures');
    await assert.rejects(handle.db.transaction(async (tx) => {
        const [customer] = await tx
            .select({ id: schema.customers.id })
            .from(schema.customers)
            .limit(1);
        const [rate] = await tx.select({ id: schema.rates.id }).from(schema.rates).limit(1);
        const at = (time) => new Date(`2040-02-03T${time}:00-05:00`);
        const insert = async (startedAt, endedAt) => {
            const [rental] = await tx
                .insert(schema.rentals)
                .values({
                customerId: customer.id,
                rateId: rate.id,
                minutes: 30,
                priceCents: 1234,
                startedAt,
                dueAt: new Date(startedAt.getTime() + 1800000),
                endedAt,
                createdBy: admin.id,
                requestId: crypto.randomUUID(),
            })
                .returning({ id: schema.rentals.id });
            return rental.id;
        };
        assert.deepEqual(await completedTrips(tx, at('10:00')), {
            date: '2040-02-03',
            count: 0,
            firstStartedAt: null,
            closedAt: null,
        });
        await insert(new Date('2040-02-03T04:30:00Z'), at('00:15')); // Ayer en Colombia.
        await insert(at('15:00'), null); // Primero del día, todavía activo.
        for (let i = 0; i < 205; i++)
            await insert(at('16:00'), at('16:30'));
        const group = await insert(at('17:00'), at('17:30'));
        const scooters = await tx
            .select({ id: schema.equipment.id })
            .from(schema.equipment)
            .where(eq(schema.equipment.kind, 'scooter'))
            .limit(4);
        await tx
            .insert(schema.rentalEquipment)
            .values(scooters.map((e) => ({ rentalId: group, equipmentId: e.id })));
        await insert(at('18:00'), at('19:15')); // Se devuelve después del cierre.
        await insert(at('19:05'), at('19:35')); // Inicia después del cierre.
        await insert(at('22:00'), at('22:30')); // Futuro: no cuenta aún.
        const open = await completedTrips(tx, at('20:00'));
        assert.equal(open.count, 208);
        assert.equal(open.firstStartedAt, at('15:00').toISOString());
        assert.equal(open.closedAt, null);
        await tx.insert(schema.dayClosings).values({
            date: '2040-02-03',
            opensAt: '16:00',
            closesAt: '19:00',
            cashCents: 0,
            transferCents: 0,
            expenses: [],
        });
        const closed = await completedTrips(tx, at('20:00'));
        assert.equal(closed.count, 206);
        assert.equal(closed.closedAt, at('19:00').toISOString());
        assert.equal(closed.firstStartedAt, at('15:00').toISOString());
        assert.equal((await completedTrips(tx, at('18:30'))).closedAt, null);
        throw rollback;
    }), (error) => error === rollback);
});
test('viajes completados: cierre al día siguiente sin duplicar viajes entre jornadas', async () => {
    const { completedTrips } = await import('./services/dashboard.js');
    const schema = await import('@rokai/db');
    const rollback = new Error('rollback de fixtures nocturnas');
    await assert.rejects(handle.db.transaction(async (tx) => {
        const [customer] = await tx
            .select({ id: schema.customers.id })
            .from(schema.customers)
            .limit(1);
        const [rate] = await tx.select({ id: schema.rates.id }).from(schema.rates).limit(1);
        await tx.insert(schema.dayClosings).values({
            date: '2040-02-03',
            opensAt: '16:00',
            closesAt: '01:00',
            closesNextDay: true,
            cashCents: 0,
            transferCents: 0,
            expenses: [],
        });
        for (const start of [
            '2040-02-03T23:00:00-05:00',
            '2040-02-04T00:00:00-05:00',
            '2040-02-04T16:00:00-05:00',
        ]) {
            const startedAt = new Date(start);
            const endedAt = new Date(startedAt.getTime() + 1800000);
            await tx.insert(schema.rentals).values({
                customerId: customer.id,
                rateId: rate.id,
                minutes: 30,
                priceCents: 1234,
                startedAt,
                endedAt,
                dueAt: endedAt,
                createdBy: admin.id,
                requestId: crypto.randomUUID(),
            });
        }
        const overnight = await completedTrips(tx, new Date('2040-02-04T00:45:00-05:00'));
        assert.equal(overnight.date, '2040-02-03');
        assert.equal(overnight.count, 2);
        assert.equal(overnight.closedAt, null);
        const closed = await completedTrips(tx, new Date('2040-02-04T01:00:00-05:00'));
        assert.equal(closed.closedAt, '2040-02-04T06:00:00.000Z');
        const next = await completedTrips(tx, new Date('2040-02-04T17:00:00-05:00'));
        assert.equal(next.date, '2040-02-04');
        assert.equal(next.count, 1);
        assert.equal(next.firstStartedAt, '2040-02-04T21:00:00.000Z');
        throw rollback;
    }), (error) => error === rollback);
});
//# sourceMappingURL=app.test.js.map