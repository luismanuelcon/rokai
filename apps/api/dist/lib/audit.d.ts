import type { Executor } from '../db.js';
export interface AuditEntry {
    userId: number | null;
    action: string;
    entity: string;
    entityId?: string | number;
    before?: unknown;
    after?: unknown;
}
export declare function recordAudit(exec: Executor, entry: AuditEntry): Promise<void>;
//# sourceMappingURL=audit.d.ts.map