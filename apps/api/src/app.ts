import { registerRentalHistoryRoutes } from './routes/rentalHistory.js';
import { registerBusinessExpenseRoutes } from './routes/businessExpenses.js';
import rateLimit from '@fastify/rate-limit';
import { registerTrackingRoutes } from './routes/tracking.js';
import { redactTrackingUrl } from './domain/tracking.js';
import Fastify, { type FastifyInstance } from 'fastify';
import compress from '@fastify/compress';
import cookie from '@fastify/cookie';
import { constants as zlibConstants } from 'node:zlib';
import type { Env } from './env.js';
import type { Db } from './db.js';
import { authPlugin } from './plugins/auth.js';
import { errorsPlugin } from './plugins/errors.js';
import { securityPlugin } from './plugins/security.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerPublicRoutes } from './routes/public.js';
import { registerRentalRoutes } from './routes/rentals.js';
import { registerDayClosingRoutes } from './routes/dayClosings.js';
import { registerReservationRoutes } from './routes/reservations.js';
import { registerWeb } from './web.js';

export async function buildApp(env: Env, db: Db): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      serializers: {
        req(req) {
          return {
            method: req.method,
            url: redactTrackingUrl(req.url ?? ''),
            hostname: req.hostname,
            remoteAddress: req.ip,
          };
        },
      },
    },
    // Solo se confía en la cabecera de proxy cuando hay un proxy real delante.
    trustProxy: env.NODE_ENV === 'production',
    bodyLimit: 32 * 1024,
    genReqId: () => crypto.randomUUID(),
  });

  // Antes que cualquier ruta: el hook `onSend` solo alcanza lo que se registre después.
  // Calidad 5 de brotli en lugar de la 11 por defecto: comprime casi igual y cuesta
  // una fracción de CPU, que es lo escaso en el contenedor (0.25 vCPU).
  await app.register(compress, {
    threshold: 1024,
    encodings: ['br', 'gzip', 'deflate'],
    brotliOptions: { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 5 } },
    zlibOptions: { level: 6 },
  });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(errorsPlugin);
  await app.register(securityPlugin, { env });
  await app.register(authPlugin, { db });

  registerPublicRoutes(app, db);
  registerAuthRoutes(app, db, env);
  registerRentalRoutes(app, db);
  registerRentalHistoryRoutes(app, db);
  registerAdminRoutes(app, db);
  registerTrackingRoutes(app, db);
  registerDayClosingRoutes(app, db);
  registerBusinessExpenseRoutes(app, db);
  registerReservationRoutes(app, db, env);

  await registerWeb(app, env.WEB_ROOT);

  return app;
}
