import type { Executor } from '../db.js';
/** Ejecutar dentro de una transacción: el bloqueo evita crear dos enlaces. */
export declare function ensureTracking(tx: Executor, rentalId: number): Promise<{
    createdAt: Date;
    rentalId: number;
    token: string;
    revokedAt: Date | null;
}>;
//# sourceMappingURL=tracking.d.ts.map