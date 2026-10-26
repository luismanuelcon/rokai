import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/**
 * scrypt con los parámetros por defecto de Node. Se conserva del MVP porque está
 * probado y no requiere dependencias nativas. La migración a Argon2id prevista en
 * ARQUITECTURA-V2 queda pendiente; `needsRehash` ya deja el punto de enganche.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  return `scrypt$${salt}$${scryptSync(password, salt, KEY_LENGTH).toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algorithm, salt, digest] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt || !digest) return false;
  const expected = Buffer.from(digest, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function needsRehash(stored: string): boolean {
  return !stored.startsWith('scrypt$');
}

/** Hash contra el que comparar cuando el correo no existe, para igualar tiempos. */
export const DUMMY_HASH = hashPassword(randomBytes(32).toString('hex'));

export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('hex');

/** Comparación en tiempo constante para tokens de igual longitud. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
