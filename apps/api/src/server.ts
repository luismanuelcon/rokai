import { buildApp } from './app.js';
import { connect } from './db.js';
import { loadEnv } from './env.js';

const env = loadEnv();
const { db, pool } = connect(env.DATABASE_URL);
const app = await buildApp(env, db);

// Abre la primera conexión antes de aceptar tráfico: el handshake TLS contra
// PostgreSQL cuesta más de un segundo y, si no, lo paga la primera visita.
await db.execute('select 1');

await app.listen({ port: env.PORT, host: env.HOST });

// Apagado ordenado: deja de aceptar conexiones, drena las en curso y cierra el pool.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void (async () => {
      app.log.info(`${signal} recibido, cerrando.`);
      await app.close();
      await pool.end();
      process.exit(0);
    })();
  });
}
