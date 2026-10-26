import { z } from 'zod';
declare const EnvSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<{
        development: "development";
        test: "test";
        production: "production";
    }>>;
    PORT: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    HOST: z.ZodDefault<z.ZodString>;
    DATABASE_URL: z.ZodString;
    APP_ORIGIN: z.ZodOptional<z.ZodString>;
    COOKIE_SECURE: z.ZodPipe<z.ZodDefault<z.ZodEnum<{
        0: "0";
        1: "1";
    }>>, z.ZodTransform<boolean, "0" | "1">>;
    SESSION_HOURS: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    LOG_LEVEL: z.ZodDefault<z.ZodEnum<{
        error: "error";
        fatal: "fatal";
        warn: "warn";
        info: "info";
        debug: "debug";
        trace: "trace";
    }>>;
}, z.core.$strip>;
export type Env = z.infer<typeof EnvSchema>;
export declare function loadEnv(source?: NodeJS.ProcessEnv): Env;
export {};
//# sourceMappingURL=env.d.ts.map