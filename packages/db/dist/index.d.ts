import pg from 'pg';
import * as schema from './schema.js';
export * as schema from './schema.js';
export * from './schema.js';
export type Database = ReturnType<typeof createDatabase>;
/** Ruta absoluta a los SQL generados por drizzle-kit, independiente del cwd. */
export declare const migrationsFolder: string;
export declare function createPool(connectionString: string): pg.Pool;
export declare function createDatabase(pool: pg.Pool): import("drizzle-orm/node-postgres").NodePgDatabase<typeof schema> & {
    $client: import("pg").Pool;
};
//# sourceMappingURL=index.d.ts.map