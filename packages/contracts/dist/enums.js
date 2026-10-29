import { z } from 'zod';
export const UserRole = z.enum(['admin', 'collaborator']);
export const EquipmentKind = z.enum(['scooter', 'helmet']);
export const EquipmentStatus = z.enum(['available', 'maintenance', 'inactive']);
export const RatePeriod = z.enum(['special', 'weekend']);
/** Documentos admitidos en Colombia, incluidos los de visitantes extranjeros. */
export const DocumentType = z.enum(['CC', 'CE', 'TI', 'PA', 'PEP', 'PPT']);
export const ConsentKind = z.enum(['operational', 'marketing']);
export const NotificationChannel = z.enum(['whatsapp', 'telegram', 'sms', 'email', 'console']);
/** `marketing` existe en el modelo pero está deshabilitada hasta la fase 2. */
export const NotificationCategory = z.enum(['utility', 'internal', 'marketing']);
export const NotificationStatus = z.enum([
    'pending',
    'sending',
    'sent',
    'delivered',
    'failed',
    'dead',
]);
//# sourceMappingURL=enums.js.map