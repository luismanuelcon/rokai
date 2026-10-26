import { sql } from 'drizzle-orm';
import { createDatabase, createPool, migrationsFolder } from './index.js';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { seed } from './seed.js';

/**
 * Reconstruye el esquema de desarrollo desde cero. Falla si NODE_ENV es production.
 */
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL no está definida.');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production') {
  console.error('reset está deshabilitado en producción.');
  process.exit(1);
}

const pool = createPool(url);
const db = createDatabase(pool);

try {
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
  await migrate(db, { migrationsFolder });
  await seed(db);
  console.log('Base de desarrollo reconstruida y poblada.');
} finally {
  await pool.end();
}
