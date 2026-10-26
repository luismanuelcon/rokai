import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import type { Env } from './env.js';
import type { Db } from './db.js';
import { authPlugin } from './plugins/auth.js';
import { errorsPlugin } from './plugins/errors.js';
import { securityPlugin } from './plugins/security.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerPublicRoutes } from './routes/public.js';
import { registerRentalRoutes } from './routes/rentals.js';

export async function buildApp(env: Env, db: Db): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    // Solo se confía en la cabecera de proxy cuando hay un proxy real delante.
    trustProxy: env.NODE_ENV === 'production',
    bodyLimit: 32 * 1024,
    genReqId: () => crypto.randomUUID(),
  });

  await app.register(cookie);
  await app.register(errorsPlugin);
  await app.register(securityPlugin, { env });
  await app.register(authPlugin, { db });

  registerPublicRoutes(app, db);
  registerAuthRoutes(app, db, env);
  registerRentalRoutes(app, db);
  registerAdminRoutes(app, db);

  return app;
}
