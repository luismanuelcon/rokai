import { existsSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';

/** Build de Vite: desde `apps/api/dist` hasta `apps/web/dist`. */
function defaultWebRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../web/dist');
}

/**
 * Sirve el frontend desde el mismo origen que la API, para que las cookies de
 * sesión y la comprobación de `Origin` sigan funcionando sin CORS.
 */
export async function registerWeb(app: FastifyInstance, root?: string): Promise<boolean> {
  const webRoot = root ?? defaultWebRoot();
  if (!existsSync(resolve(webRoot, 'index.html'))) {
    app.log.warn({ webRoot }, 'Sin build del frontend; se sirve solo la API.');
    return false;
  }

  await app.register(fastifyStatic, {
    root: webRoot,
    // Registra una ruta por archivo real: las rutas desconocidas caen en el
    // manejador de 404, que decide entre la SPA y un error de API.
    wildcard: false,
    index: ['index.html'],
    setHeaders(reply, path) {
      // Solo los archivos con hash de Vite pueden ser inmutables. Los assets
      // de `public` conservan nombres estables y deben revalidarse al cambiarlos.
      const hasViteHash = /-[a-z0-9_-]{8}\.[a-z0-9]+$/i.test(basename(path));
      reply.header(
        'Cache-Control',
        path.endsWith('.html') || !hasViteHash ? 'no-cache' : 'public, max-age=31536000, immutable',
      );
    },
  });

  return true;
}
