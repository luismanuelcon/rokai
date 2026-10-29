import { auditLog } from '@rokai/db';
export async function recordAudit(exec, entry) {
    await exec.insert(auditLog).values({
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId === undefined ? '' : String(entry.entityId),
        before: entry.before ?? null,
        after: entry.after ?? null,
    });
}
//# sourceMappingURL=audit.js.map