import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.js';
import type { Env } from '../env.js';
export declare function registerAuthRoutes(app: FastifyInstance, db: Db, env: Env): void;
/** Cierra todas las sesiones de un usuario, por ejemplo al desactivarlo. */
export declare function revokeSessions(db: Db, userId: number): Promise<void>;
//# sourceMappingURL=auth.d.ts.map