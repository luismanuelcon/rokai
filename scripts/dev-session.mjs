/**
 * Sesión temporal para revisar el panel en local sin manejar contraseñas.
 *   node scripts/dev-session.mjs        → crea la sesión e imprime la cookie
 *   node scripts/dev-session.mjs --drop → borra las sesiones que creó
 */
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const url = /DATABASE_URL=(.*)/.exec(readFileSync('.env', 'utf8'))[1].trim();
const client = new pg.Client({ connectionString: url });
await client.connect();

if (process.argv.includes('--drop')) {
  const { rowCount } = await client.query("delete from sessions where csrf_token like 'dev-%'");
  console.log(`sesiones de revisión borradas: ${rowCount}`);
} else {
  const token = randomBytes(32).toString('hex');
  await client.query(
    `insert into sessions (token_hash, user_id, csrf_token, expires_at)
     values ($1, (select id from users where role = 'admin' and active order by id limit 1), $2, now() + interval '4 hours')`,
    [createHash('sha256').update(token).digest('hex'), `dev-${randomBytes(16).toString('hex')}`],
  );
  console.log(`rokai_session=${token}`);
}

await client.end();
