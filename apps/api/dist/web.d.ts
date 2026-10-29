import type { FastifyInstance } from 'fastify';
/**
 * Sirve el frontend desde el mismo origen que la API, para que las cookies de
 * sesión y la comprobación de `Origin` sigan funcionando sin CORS.
 */
export declare function registerWeb(app: FastifyInstance, root?: string): Promise<boolean>;
//# sourceMappingURL=web.d.ts.map