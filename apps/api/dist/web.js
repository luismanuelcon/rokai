import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
/** Build de Vite: desde `apps/api/dist` hasta `apps/web/dist`. */
function defaultWebRoot() {
    return resolve(dirname(fileURLToPath(import.meta.url)), '../../web/dist');
}
/**
 * Sirve el frontend desde el mismo origen que la API, para que las cookies de
 * sesión y la comprobación de `Origin` sigan funcionando sin CORS.
 */
export async function registerWeb(app, root) {
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
            // Los nombres de los recursos de Vite llevan hash; `index.html` no, y si
            // se cachea el despliegue siguiente seguiría sirviendo el bundle viejo.
            reply.header('Cache-Control', path.endsWith('.html') ? 'no-cache' : 'public, max-age=31536000, immutable');
        },
    });
    return true;
}
//# sourceMappingURL=web.js.map