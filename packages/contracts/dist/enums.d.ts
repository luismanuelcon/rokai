import { z } from 'zod';
export declare const UserRole: z.ZodEnum<{
    admin: "admin";
    collaborator: "collaborator";
}>;
export type UserRole = z.infer<typeof UserRole>;
export declare const EquipmentKind: z.ZodEnum<{
    scooter: "scooter";
    helmet: "helmet";
}>;
export type EquipmentKind = z.infer<typeof EquipmentKind>;
export declare const EquipmentStatus: z.ZodEnum<{
    available: "available";
    maintenance: "maintenance";
    inactive: "inactive";
}>;
export type EquipmentStatus = z.infer<typeof EquipmentStatus>;
export declare const RatePeriod: z.ZodEnum<{
    special: "special";
    weekend: "weekend";
}>;
export type RatePeriod = z.infer<typeof RatePeriod>;
/** Documentos admitidos en Colombia, incluidos los de visitantes extranjeros. */
export declare const DocumentType: z.ZodEnum<{
    CC: "CC";
    CE: "CE";
    TI: "TI";
    PA: "PA";
    PEP: "PEP";
    PPT: "PPT";
}>;
export type DocumentType = z.infer<typeof DocumentType>;
export declare const ConsentKind: z.ZodEnum<{
    operational: "operational";
    marketing: "marketing";
}>;
export type ConsentKind = z.infer<typeof ConsentKind>;
export declare const NotificationChannel: z.ZodEnum<{
    email: "email";
    whatsapp: "whatsapp";
    telegram: "telegram";
    sms: "sms";
    console: "console";
}>;
export type NotificationChannel = z.infer<typeof NotificationChannel>;
/** `marketing` existe en el modelo pero está deshabilitada hasta la fase 2. */
export declare const NotificationCategory: z.ZodEnum<{
    marketing: "marketing";
    utility: "utility";
    internal: "internal";
}>;
export type NotificationCategory = z.infer<typeof NotificationCategory>;
export declare const NotificationStatus: z.ZodEnum<{
    pending: "pending";
    sending: "sending";
    sent: "sent";
    delivered: "delivered";
    failed: "failed";
    dead: "dead";
}>;
export type NotificationStatus = z.infer<typeof NotificationStatus>;
//# sourceMappingURL=enums.d.ts.map