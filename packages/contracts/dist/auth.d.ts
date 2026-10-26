import { z } from 'zod';
/** Mínimo de 12 caracteres: se conserva la regla ya vigente en el MVP. */
export declare const Password: z.ZodString;
export declare const LoginRequest: z.ZodObject<{
    email: z.ZodEmail;
    password: z.ZodString;
}, z.core.$strip>;
export type LoginRequest = z.infer<typeof LoginRequest>;
export declare const SessionUser: z.ZodObject<{
    id: z.ZodNumber;
    name: z.ZodString;
    email: z.ZodString;
    role: z.ZodEnum<{
        admin: "admin";
        worker: "worker";
        operator: "operator";
    }>;
}, z.core.$strip>;
export type SessionUser = z.infer<typeof SessionUser>;
export declare const SessionResponse: z.ZodObject<{
    user: z.ZodNullable<z.ZodObject<{
        id: z.ZodNumber;
        name: z.ZodString;
        email: z.ZodString;
        role: z.ZodEnum<{
            admin: "admin";
            worker: "worker";
            operator: "operator";
        }>;
    }, z.core.$strip>>;
    csrf: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type SessionResponse = z.infer<typeof SessionResponse>;
export declare const CreateUserRequest: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodEmail;
    password: z.ZodString;
    role: z.ZodEnum<{
        admin: "admin";
        worker: "worker";
        operator: "operator";
    }>;
}, z.core.$strip>;
export type CreateUserRequest = z.infer<typeof CreateUserRequest>;
export declare const UpdateUserRequest: z.ZodObject<{
    active: z.ZodBoolean;
}, z.core.$strip>;
export type UpdateUserRequest = z.infer<typeof UpdateUserRequest>;
//# sourceMappingURL=auth.d.ts.map