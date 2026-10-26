import type { FastifyInstance } from 'fastify';
import type { UserRole } from '@rokai/contracts';
import type { Db } from '../db.js';
export declare const SESSION_COOKIE = "rokai_session";
export interface SessionInfo {
    tokenHash: string;
    csrfToken: string;
    user: {
        id: number;
        name: string;
        email: string;
        role: UserRole;
    };
}
declare module 'fastify' {
    interface FastifyRequest {
        session: SessionInfo | null;
    }
    interface FastifyInstance {
        requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
        requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
}
export declare const authPlugin: (app: FastifyInstance, opts: {
    db: Db;
}) => void;
//# sourceMappingURL=auth.d.ts.map