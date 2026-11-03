import { randomBytes } from 'node:crypto';
export const newTrackingToken = () => randomBytes(32).toString('base64url');
export const validTrackingToken = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token);
export const trackingPath = (token: string) => `/alquiler/seguimiento/${token}`;
export function trackingClock(dueAt: Date, endedAt: Date | null, now: Date) {
  return {
    status: endedAt
      ? ('closed' as const)
      : dueAt.getTime() <= now.getTime()
        ? ('expired' as const)
        : ('active' as const),
    remainingSeconds: endedAt
      ? 0
      : Math.max(0, Math.ceil((dueAt.getTime() - now.getTime()) / 1000)),
  };
}
export function redactTrackingUrl(url: string) {
  return (
    url
      .replace(/(\/(?:api\/v1\/tracking|alquiler\/seguimiento)\/)[^?\s/]*/g, '$1[REDACTED]')
      .split('?')[0] ?? ''
  );
}
