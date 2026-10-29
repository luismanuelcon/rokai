import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { and, eq, gt } from 'drizzle-orm';
import { sessions, users } from '@rokai/db';
import type { UserRole } from '@rokai/contracts';
import type { Db, Executor } from '../db.js';
import { sha256, safeEqual } from '../lib/crypto.js';
import { forbidden, unauthorized } from '../lib/http-error.js';

export const SESSION_COOKIE = 'rokai_session';

export function publicRole(role: typeof users.$inferSelect.role): UserRole {
  return role === 'admin' ? 'admin' : 'collaborator';
}

export interface SessionInfo {
  tokenHash: string;
  csrfToken: string;
  user: { id: number; name: string; email: string; role: UserRole };
}

export async function revokeSessions(exec: Executor, userId: number): Promise<void> {
  await exec.delete(sessions).where(eq(sessions.userId, userId));
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

async function lookup(db: Db, token: string): Promise<SessionInfo | null> {
  const rows = await db
    .select({
      tokenHash: sessions.tokenHash,
      csrfToken: sessions.csrfToken,
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, sha256(token)),
        gt(sessions.expiresAt, new Date()),
        eq(users.active, true),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return {
    tokenHash: row.tokenHash,
    csrfToken: row.csrfToken,
    user: { id: row.id, name: row.name, email: row.email, role: publicRole(row.role) },
  };
}

export const authPlugin = fp(function authPlugin(app: FastifyInstance, opts: { db: Db }) {
  app.decorateRequest('session', null);

  app.addHook('onRequest', async (req) => {
    const token = req.cookies[SESSION_COOKIE];
    req.session = token ? await lookup(opts.db, token) : null;
  });

  // La verificación CSRF vive aquí porque depende del token de la sesión.
  // Los hooks deben ser async: Fastify espera una promesa o una llamada a `done`;
  // uno síncrono sin ninguna de las dos deja la petición colgada para siempre.
  app.addHook('onRequest', async (req) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return;
    if (!req.session) return;
    const header = req.headers['x-csrf-token'];
    if (typeof header !== 'string' || !safeEqual(header, req.session.csrfToken)) {
      throw forbidden('Solicitud de seguridad no válida. Recarga la página.');
    }
  });

  app.decorate('requireAuth', async (req: FastifyRequest) => {
    if (!req.session) throw unauthorized('Inicia sesión para acceder al portal de gestión.');
  });

  app.decorate('requireAdmin', async (req: FastifyRequest) => {
    if (!req.session) throw unauthorized('Inicia sesión para acceder al portal de gestión.');
    if (req.session.user.role !== 'admin') {
      throw forbidden('Esta función requiere permisos de administrador.');
    }
  });
});
