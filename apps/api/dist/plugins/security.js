import fp from 'fastify-plugin';
import { forbidden } from '../lib/http-error.js';
const CSP = [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self'",
    "script-src 'self'",
    "connect-src 'self'",
    "font-src 'self'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
].join('; ');
export const securityPlugin = fp(function securityPlugin(app, opts) {
    app.addHook('onSend', async (_req, reply, payload) => {
        reply.header('X-Content-Type-Options', 'nosniff');
        reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
        reply.header('X-Frame-Options', 'DENY');
        reply.header('Content-Security-Policy', CSP);
        reply.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
        if (opts.env.COOKIE_SECURE) {
            reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }
        return payload;
    });
    // Defensa CSRF de primera capa: el origen debe coincidir exactamente.
    app.addHook('onRequest', async (req) => {
        if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS')
            return;
        const expected = opts.env.APP_ORIGIN ?? `http://${req.headers.host ?? ''}`;
        if (req.headers.origin !== expected) {
            throw forbidden('Origen de solicitud no autorizado.');
        }
    });
});
//# sourceMappingURL=security.js.map