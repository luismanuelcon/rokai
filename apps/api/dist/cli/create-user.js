import { eq } from 'drizzle-orm';
import { users } from '@rokai/db';
import { CreateUserRequest } from '@rokai/contracts';
import { connect } from '../db.js';
import { loadEnv } from '../env.js';
import { hashPassword } from '../lib/crypto.js';
const [email, name, role = 'admin'] = process.argv.slice(2);
const password = process.env.ROKAI_PASSWORD;
const parsed = CreateUserRequest.safeParse({ email, name, password, role });
if (!parsed.success) {
    console.error('Uso: ROKAI_PASSWORD=<12+ caracteres> npm run create-user -- correo "Nombre" [admin|worker|operator]');
    for (const issue of parsed.error.issues) {
        console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
}
const env = loadEnv();
const { db, pool } = connect(env.DATABASE_URL);
try {
    const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, parsed.data.email));
    if (existing.length > 0) {
        console.error('Ese correo ya está registrado.');
        process.exit(1);
    }
    await db.insert(users).values({
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash: hashPassword(parsed.data.password),
        role: parsed.data.role,
    });
    console.log(`Usuario ${parsed.data.email} creado con rol ${parsed.data.role}.`);
}
finally {
    await pool.end();
}
//# sourceMappingURL=create-user.js.map