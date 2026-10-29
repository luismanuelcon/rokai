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

/**
 * Azure PostgreSQL exige transporte cifrado y `pg` no activa TLS por su cuenta.
 * Se verifica la cadena del servidor contra los certificados raíz de Node, así
 * que un intermediario no puede suplantar la base de datos. Solo se omite en
 * servidores locales, donde no hay certificado que validar.
 */
function tlsFor(connectionString: string): pg.PoolConfig['ssl'] {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return undefined;
  }
  if (url.searchParams.get('sslmode') === 'disable') return undefined;

  const host = url.hostname;
  const esLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  return esLocal ? undefined : { rejectUnauthorized: true };
}

export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({ connectionString, max: 10, ssl: tlsFor(connectionString) });
}

export function createDatabase(pool: pg.Pool) {
  return drizzle(pool, { schema, casing: 'snake_case' });
}
