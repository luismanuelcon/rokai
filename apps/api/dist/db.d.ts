import { createDatabase } from '@rokai/db';
import type pg from 'pg';
export type Db = ReturnType<typeof createDatabase>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** Acepta la conexión normal o una transacción en curso. */
export type Executor = Db | Tx;
export interface DbHandle {
    db: Db;
    pool: pg.Pool;
}
export declare function connect(connectionString: string): DbHandle;
//# sourceMappingURL=db.d.ts.map