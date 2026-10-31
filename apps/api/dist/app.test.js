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
const ORIGIN = 'http://127.0.0.1:3000';
const PASSWORD = 'Test-password-only-123';
/** PNG de 1x1 válido: lo mínimo que acepta el contrato de la firma. */
const SIGNATURE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
/** Campos de cierre que ahora exige todo alquiler. */
const CLOSING = { signature: SIGNATURE, termsAccepted: true };
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
    const finished = await call(`/api/v1/rentals/${rentalId}/finish`, 'POST', { notes: 'Sin novedades', paymentMethod: 'cash' }, worker);
    assert.equal(finished.status, 200);
    assert.equal((await call(`/api/v1/rentals/${rentalId}/finish`, 'POST', { paymentMethod: 'cash' }, worker))
        .status, 409);
    const final = await call('/api/v1/dashboard', 'GET', undefined, worker);
    assert.equal(final.body.rentals[0].finalPriceCents, rate.priceCents);
    assert.equal(final.body.rentals[0].paymentMethod, 'cash');
    assert.equal(final.body.rentals[0].lateFeeCents, 0);
    assert.equal(final.body.rentals[0].endedByName, 'Colaborador');
    assert.equal(final.body.equipment.filter((e) => e.busy).length, 0);
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
    await call(`/api/v1/rentals/${String(omitted.body.id)}/finish`, 'POST', { paymentMethod: 'transfer' }, admin);
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
        assert.equal(span, rental.minutes * 60_000, 'dueAt debe coincidir con la duración contratada');
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
    const removed = await call(`/api/v1/admin/rentals/${id}`, 'DELETE', undefined, admin);
    assert.equal(removed.status, 200);
    assert.equal((await call(`/api/v1/admin/rentals/${id}`, 'DELETE', undefined, admin)).status, 404, 'borrar dos veces no debe tener efecto');
    const after = await call('/api/v1/dashboard', 'GET', undefined, admin);
    assert.ok(!after.body.rentals.some((r) => String(r.id) === id));
    // El cascade de rental_equipment libera los equipos sin tocarlos a mano.
    const released = after.body.equipment.filter((e) => (e.id === scooter.id || e.id === helmet.id) && !e.busy);
    assert.equal(released.length, 2);
    const adminData = await call('/api/v1/admin/data', 'GET', undefined, admin);
    const actions = adminData.body.audit.map((a) => a.action);
    assert.ok(actions.includes('eliminar_alquiler'), 'el borrado debe quedar en la auditoría');
});
//# sourceMappingURL=app.test.js.map