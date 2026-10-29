import { z } from 'zod';
import { Id } from './common.js';
import { NotificationCategory, NotificationChannel, NotificationStatus, ConsentKind, } from './enums.js';
export const TemplateKey = z.enum([
    'rental.started',
    'rental.due_soon',
    'rental.overdue',
    'rental.finished',
    'equipment.overdue_alert',
    'equipment.incident',
]);
export const Notification = z.object({
    id: Id,
    channel: NotificationChannel,
    category: NotificationCategory,
    templateKey: z.string(),
    status: NotificationStatus,
    attempts: z.number().int(),
    scheduledFor: z.iso.datetime(),
    nextAttemptAt: z.iso.datetime().nullable(),
    providerMessageId: z.string().nullable(),
    lastError: z.string().nullable(),
    createdAt: z.iso.datetime(),
});
export const UpdateConsentRequest = z.object({
    kind: ConsentKind,
    granted: z.boolean(),
});
//# sourceMappingURL=notifications.js.map