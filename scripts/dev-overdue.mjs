/** Adelanta el vencimiento de un alquiler para probar el recargo en local. */
import { readFileSync } from 'node:fs';
import pg from 'pg';

const id = Number(process.argv[2]);
const minutes = Number(process.argv[3] ?? 3);
const url = /DATABASE_URL=(.*)/.exec(readFileSync('.env', 'utf8'))[1].trim();
const client = new pg.Client({ connectionString: url });
await client.connect();
const { rowCount } = await client.query(
  `update rentals set due_at = now() - ($2 || ' minutes')::interval where id = $1`,
  [id, minutes],
);
console.log(`alquileres actualizados: ${rowCount}`);
await client.end();
