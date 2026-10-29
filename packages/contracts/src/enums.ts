import { z } from 'zod';

export const UserRole = z.enum(['admin', 'collaborator']);
export type UserRole = z.infer<typeof UserRole>;

export const EquipmentKind = z.enum(['scooter', 'helmet']);
export type EquipmentKind = z.infer<typeof EquipmentKind>;

export const EquipmentStatus = z.enum(['available', 'maintenance', 'inactive']);
export type EquipmentStatus = z.infer<typeof EquipmentStatus>;

export const RatePeriod = z.enum(['special', 'weekend']);
export type RatePeriod = z.infer<typeof RatePeriod>;

/** Documentos admitidos en Colombia, incluidos los de visitantes extranjeros. */
export const DocumentType = z.enum(['CC', 'CE', 'TI', 'PA', 'PEP', 'PPT']);
export type DocumentType = z.infer<typeof DocumentType>;

export const ConsentKind = z.enum(['operational', 'marketing']);
export type ConsentKind = z.infer<typeof ConsentKind>;

export const NotificationChannel = z.enum(['whatsapp', 'telegram', 'sms', 'email', 'console']);
export type NotificationChannel = z.infer<typeof NotificationChannel>;

/** `marketing` existe en el modelo pero está deshabilitada hasta la fase 2. */
export const NotificationCategory = z.enum(['utility', 'internal', 'marketing']);
export type NotificationCategory = z.infer<typeof NotificationCategory>;

export const NotificationStatus = z.enum([
  'pending',
  'sending',
  'sent',
  'delivered',
  'failed',
  'dead',
]);
export type NotificationStatus = z.infer<typeof NotificationStatus>;
