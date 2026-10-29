import type { FastifyInstance } from 'fastify';
import { and, eq, lt, sql } from 'drizzle-orm';
import { loginAttempts, sessions, users } from '@rokai/db';
import { LoginRequest } from '@rokai/contracts';
import type { Db } from '../db.js';
import type { Env } from '../env.js';
import { DUMMY_HASH, randomToken, sha256, verifyPassword } from '../lib/crypto.js';
import { recordAudit } from '../lib/audit.js';
import { tooMany, unauthorized } from '../lib/http-error.js';
import { publicRole, SESSION_COOKIE } from '../plugins/auth.js';
import { rentalDrafts } from '@rokai/db';

const WINDOW_MS = 15 * 60_000;
const MAX_PER_IDENTITY = 8;
const MAX_PER_IP = 40;

async function assertUnderLimit(db: Db, key: string, max: number): Promise<void> {
  const rows = await db.select().from(loginAttempts).where(eq(loginAttempts.key, key)).limit(1);
  const row = rows[0];
  if (row && row.resetAt > new Date() && row.count >= max) {
    throw tooMany('Demasiados intentos. Intenta de nuevo en 15 minutos.');
  }
}

async function registerFailure(db: Db, key: string): Promise<void> {
  const resetAt = new Date(Date.now() + WINDOW_MS);
  await db
    .insert(loginAttempts)
    .values({ key, count: 1, resetAt })
    .onConflictDoUpdate({
      target: loginAttempts.key,
      set: {
        count: sql`CASE WHEN ${loginAttempts.resetAt} < now() THEN 1 ELSE ${loginAttempts.count} + 1 END`,
        resetAt: sql`CASE WHEN ${loginAttempts.resetAt} < now() THEN excluded.reset_at ELSE ${loginAttempts.resetAt} END`,
      },
    });
}

export function registerAuthRoutes(app: FastifyInstance, db: Db, env: Env): void {
  app.get('/api/v1/auth/session', (req) => ({
    user: req.session?.user ?? null,
    csrf: req.session?.csrfToken,
  }));

  app.post('/api/v1/auth/login', async (req, reply) => {
    const body = LoginRequest.parse(req.body);
    // `req.ip` respeta trustProxy, configurado solo para proxies conocidos.
    const ipKey = sha256(req.ip);
    const identityKey = sha256(`${req.ip}:${body.email}`);

    await assertUnderLimit(db, identityKey, MAX_PER_IDENTITY);
    await assertUnderLimit(db, ipKey, MAX_PER_IP);

    const found = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
    const user = found[0];
    // Se verifica siempre, incluso sin usuario, para no filtrar su existencia por tiempo.
    const valid = verifyPassword(body.password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !valid || !user.active) {
      await registerFailure(db, identityKey);
      await registerFailure(db, ipKey);
      throw unauthorized('Correo o contraseña incorrectos.');
    }

    await db.delete(loginAttempts).where(eq(loginAttempts.key, identityKey));
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));

    const token = randomToken();
    const csrfToken = randomToken();
    const expiresAt = new Date(Date.now() + env.SESSION_HOURS * 3_600_000);
    await db
      .insert(sessions)
      .values({ tokenHash: sha256(token), userId: user.id, csrfToken, expiresAt });
    await recordAudit(db, {
      userId: user.id,
      action: 'inicio_sesion',
      entity: 'user',
      entityId: user.id,
    });

    void reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: env.COOKIE_SECURE,
      path: '/',
      maxAge: env.SESSION_HOURS * 3600,
    });

    return {
      user: { id: user.id, name: user.name, email: user.email, role: publicRole(user.role) },
      csrf: csrfToken,
    };
  });

  app.post('/api/v1/auth/logout', { onRequest: [app.requireAuth] }, async (req, reply) => {
    const session = req.session!;
    await db.delete(sessions).where(eq(sessions.tokenHash, session.tokenHash));
    await db.delete(rentalDrafts).where(eq(rentalDrafts.userId, session.user.id));
    void reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });
}

/** Cierra todas las sesiones de un usuario, por ejemplo al desactivarlo. */
export async function revokeSessions(db: Db, userId: number): Promise<void> {
  await db.delete(sessions).where(and(eq(sessions.userId, userId)));
}
