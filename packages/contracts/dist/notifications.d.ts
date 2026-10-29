import { z } from 'zod';
export declare const TemplateKey: z.ZodEnum<{
    "rental.started": "rental.started";
    "rental.due_soon": "rental.due_soon";
    "rental.overdue": "rental.overdue";
    "rental.finished": "rental.finished";
    "equipment.overdue_alert": "equipment.overdue_alert";
    "equipment.incident": "equipment.incident";
}>;
export type TemplateKey = z.infer<typeof TemplateKey>;
export declare const Notification: z.ZodObject<{
    id: z.ZodNumber;
    channel: z.ZodEnum<{
        email: "email";
        whatsapp: "whatsapp";
        telegram: "telegram";
        sms: "sms";
        console: "console";
    }>;
    category: z.ZodEnum<{
        marketing: "marketing";
        utility: "utility";
        internal: "internal";
    }>;
    templateKey: z.ZodString;
    status: z.ZodEnum<{
        pending: "pending";
        sending: "sending";
        sent: "sent";
        delivered: "delivered";
        failed: "failed";
        dead: "dead";
    }>;
    attempts: z.ZodNumber;
    scheduledFor: z.ZodISODateTime;
    nextAttemptAt: z.ZodNullable<z.ZodISODateTime>;
    providerMessageId: z.ZodNullable<z.ZodString>;
    lastError: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodISODateTime;
}, z.core.$strip>;
export type Notification = z.infer<typeof Notification>;
export declare const UpdateConsentRequest: z.ZodObject<{
    kind: z.ZodEnum<{
        operational: "operational";
        marketing: "marketing";
    }>;
    granted: z.ZodBoolean;
}, z.core.$strip>;
export type UpdateConsentRequest = z.infer<typeof UpdateConsentRequest>;
//# sourceMappingURL=notifications.d.ts.map