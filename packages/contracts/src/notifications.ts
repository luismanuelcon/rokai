import { z } from 'zod';
import { Id } from './common.js';
import {
  NotificationCategory,
  NotificationChannel,
  NotificationStatus,
  ConsentKind,
} from './enums.js';

export const TemplateKey = z.enum([
  'rental.started',
  'rental.due_soon',
  'rental.overdue',
  'rental.finished',
  'equipment.overdue_alert',
  'equipment.incident',
]);
export type TemplateKey = z.infer<typeof TemplateKey>;

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
export type Notification = z.infer<typeof Notification>;

export const UpdateConsentRequest = z.object({
  kind: ConsentKind,
  granted: z.boolean(),
});
export type UpdateConsentRequest = z.infer<typeof UpdateConsentRequest>;
