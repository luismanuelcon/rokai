import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as schema from './schema.js';

export * as schema from './schema.js';
export * from './schema.js';

export type Database = ReturnType<typeof createDatabase>;

/** Ruta absoluta a los SQL generados por drizzle-kit, independiente del cwd. */
export const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'drizzle');

export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({ connectionString, max: 10 });
}

export function createDatabase(pool: pg.Pool) {
  return drizzle(pool, { schema, casing: 'snake_case' });
}
