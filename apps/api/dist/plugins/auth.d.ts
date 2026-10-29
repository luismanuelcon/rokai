import type { FastifyInstance } from 'fastify';
import { users } from '@rokai/db';
import type { UserRole } from '@rokai/contracts';
import type { Db, Executor } from '../db.js';
export declare const SESSION_COOKIE = "rokai_session";
export declare function publicRole(role: typeof users.$inferSelect.role): UserRole;
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
export declare function revokeSessions(exec: Executor, userId: number): Promise<void>;
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