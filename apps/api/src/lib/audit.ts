import { auditLog } from '@rokai/db';
import type { Executor } from '../db.js';

export interface AuditEntry {
  userId: number | null;
  action: string;
  entity: string;
  entityId?: string | number;
  before?: unknown;
  after?: unknown;
}

export async function recordAudit(exec: Executor, entry: AuditEntry): Promise<void> {
  await exec.insert(auditLog).values({
    userId: entry.userId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId === undefined ? '' : String(entry.entityId),
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
}
