import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { CreateRentalRequest } from '@rokai/contracts';
import { customers, migrationsFolder, rentals, users } from '@rokai/db';
import { seed } from '@rokai/db/seed';
import { activeRates, equipmentWithBusy } from '../repositories/catalog.js';
import { connect } from '../db.js';
import { loadEnv } from '../env.js';
import { hashPassword } from '../lib/crypto.js';
import { createRental } from '../services/rentals.js';
const DEMO_PASSWORD = 'RokaiLocal-2026!';
const DEMO_DOCUMENT = 'DEMO-LOCAL-001';
const DEMO_NOTE = '[DEMO LOCAL] Alquiler ficticio para probar devoluciones.';
const SIGNATURE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const env = loadEnv();
const databaseUrl = new URL(env.DATABASE_URL);
if (env.NODE_ENV !== 'development' ||
    !['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname) ||
    databaseUrl.pathname !== '/rokai_dev') {
    throw new Error('Los datos de demostración solo se pueden cargar en localhost/rokai_dev.');
}
const { db, pool } = connect(env.DATABASE_URL);
async function ensureUser(email, name, role) {
    const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(sql `lower(${users.email}) = ${email}`)
        .limit(1);
    const passwordHash = hashPassword(DEMO_PASSWORD);
    if (existing[0]) {
        await db
            .update(users)
            .set({ name, email, passwordHash, role, active: true })
            .where(eq(users.id, existing[0].id));
        return existing[0].id;
    }
    const inserted = await db
        .insert(users)
        .values({ name, email, passwordHash, role })
        .returning({ id: users.id });
    const user = inserted[0];
    if (!user)
        throw new Error(`No se pudo crear ${email}.`);
    return user.id;
}
async function ensureDemoCustomer() {
    const existing = await db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.documentType, 'CC'), eq(customers.document, DEMO_DOCUMENT)))
        .limit(1);
    if (existing[0])
        return existing[0].id;
    const inserted = await db
        .insert(customers)
        .values({ fullName: 'Cliente Demo Local', documentType: 'CC', document: DEMO_DOCUMENT })
        .returning({ id: customers.id });
    const customer = inserted[0];
    if (!customer)
        throw new Error('No se pudo crear el cliente de demostración.');
    return customer.id;
}
async function ensureOverdueDemoRental(adminId) {
    const customerId = await ensureDemoCustomer();
    const activeDemo = await db
        .select({
        id: rentals.id,
        minutes: rentals.minutes,
        preparationMinutes: rentals.preparationMinutes,
    })
        .from(rentals)
        .where(and(eq(rentals.customerId, customerId), isNull(rentals.endedAt), sql `${rentals.notes} LIKE '[DEMO LOCAL]%'`))
        .orderBy(desc(rentals.id))
        .limit(1);
    if (activeDemo[0]) {
        const dueAt = new Date(Date.now() - 5 * 60_000);
        const startedAt = new Date(dueAt.getTime() - (activeDemo[0].minutes + activeDemo[0].preparationMinutes) * 60_000);
        await db.update(rentals).set({ startedAt, dueAt }).where(eq(rentals.id, activeDemo[0].id));
        return activeDemo[0].id;
    }
    const rate = (await activeRates(db)).find((candidate) => candidate.minutes === 15 && candidate.quantity === 1);
    if (!rate)
        throw new Error('No hay una tarifa local vigente de 15 minutos para sembrar.');
    const available = await equipmentWithBusy(db);
    const scooter = available.find((item) => item.kind === 'scooter' && item.status === 'available' && !item.busy);
    const helmet = available.find((item) => item.kind === 'helmet' && item.status === 'available' && !item.busy);
    if (!scooter || !helmet)
        throw new Error('Se necesita una patineta y un casco disponibles.');
    const request = CreateRentalRequest.parse({
        requestId: randomUUID(),
        customer: {
            fullName: 'Cliente Demo Local',
            documentType: 'CC',
            document: DEMO_DOCUMENT,
            phone: null,
        },
        rateId: rate.id,
        equipmentIds: [scooter.id, helmet.id],
        notes: DEMO_NOTE,
        signature: SIGNATURE,
        termsAccepted: true,
    });
    const created = await createRental(db, { id: adminId, name: 'Admin Demo Local' }, request);
    const rental = await db
        .select({ minutes: rentals.minutes, preparationMinutes: rentals.preparationMinutes })
        .from(rentals)
        .where(eq(rentals.id, created.id))
        .limit(1);
    if (!rental[0])
        throw new Error('No se pudo recuperar el alquiler de demostración.');
    const dueAt = new Date(Date.now() - 5 * 60_000);
    const startedAt = new Date(dueAt.getTime() - (rental[0].minutes + rental[0].preparationMinutes) * 60_000);
    await db.update(rentals).set({ startedAt, dueAt }).where(eq(rentals.id, created.id));
    return created.id;
}
try {
    await migrate(db, { migrationsFolder });
    await seed(db);
    const adminId = await ensureUser('admin@rokai.test', 'Admin Demo Local', 'admin');
    await ensureUser('operador@rokai.test', 'Operador Demo Local', 'worker');
    const rentalId = await ensureOverdueDemoRental(adminId);
    console.log('Datos locales listos en rokai_dev.');
    console.log('Admin: admin@rokai.test / Operador: operador@rokai.test');
    console.log(`Contraseña para ambas cuentas: ${DEMO_PASSWORD}`);
    console.log(`Alquiler activo de prueba: #${rentalId} (vencido hace 5 minutos).`);
    console.log('El recargo local queda en 0; cámbialo desde Administración si quieres probar importes.');
}
finally {
    await pool.end();
}
//# sourceMappingURL=seed-local-demo.js.map