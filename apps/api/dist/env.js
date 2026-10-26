import { z } from 'zod';
const EnvSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(0).max(65535).default(3000),
    HOST: z.string().default('127.0.0.1'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria.'),
    /** Carpeta del build del frontend. Por defecto, `apps/web/dist`. */
    WEB_ROOT: z.string().optional(),
    /** Origen externo exacto. En desarrollo se deriva del host recibido. */
    APP_ORIGIN: z.string().url().optional(),
    COOKIE_SECURE: z
        .enum(['0', '1'])
        .default('0')
        .transform((v) => v === '1'),
    SESSION_HOURS: z.coerce.number().int().min(1).max(24).default(8),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});
export function loadEnv(source = process.env) {
    const parsed = EnvSchema.safeParse(source);
    if (!parsed.success) {
        const detail = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
        throw new Error(`Configuración inválida:\n  ${detail}`);
    }
    return parsed.data;
}
//# sourceMappingURL=env.js.map