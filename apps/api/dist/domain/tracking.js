import { randomBytes } from 'node:crypto';
export const newTrackingToken = () => randomBytes(32).toString('base64url');
export const validTrackingToken = (token) => /^[A-Za-z0-9_-]{43}$/.test(token);
export const trackingPath = (token) => `/alquiler/seguimiento/${token}`;
export function trackingClock(dueAt, endedAt, now) {
    return {
        status: endedAt
            ? 'closed'
            : dueAt.getTime() <= now.getTime()
                ? 'expired'
                : 'active',
        remainingSeconds: endedAt
            ? 0
            : Math.max(0, Math.ceil((dueAt.getTime() - now.getTime()) / 1000)),
    };
}
export function redactTrackingUrl(url) {
    return (url
        .replace(/(\/(?:api\/v1\/tracking|alquiler\/seguimiento)\/)[^?\s/]*/g, '$1[REDACTED]')
        .split('?')[0] ?? '');
}
//# sourceMappingURL=tracking.js.map