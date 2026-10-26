import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.js';
export declare function readSettings(db: Db): Promise<Record<string, string>>;
export declare function registerPublicRoutes(app: FastifyInstance, db: Db): void;
//# sourceMappingURL=public.d.ts.map