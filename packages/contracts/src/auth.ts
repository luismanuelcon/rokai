import { z } from 'zod';
import { Email, Id } from './common.js';
import { UserRole } from './enums.js';

/** Mínimo de 12 caracteres: se conserva la regla ya vigente en el MVP. */
export const Password = z
  .string()
  .min(12, 'La contraseña debe tener al menos 12 caracteres.')
  .max(256);

export const LoginRequest = z.object({
  email: Email,
  password: z.string().min(1).max(256),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const SessionUser = z.object({
  id: Id,
  name: z.string(),
  email: z.string(),
  role: UserRole,
});
export type SessionUser = z.infer<typeof SessionUser>;

export const SessionResponse = z.object({
  user: SessionUser.nullable(),
  csrf: z.string().optional(),
});
export type SessionResponse = z.infer<typeof SessionResponse>;

export const CreateUserRequest = z.object({
  name: z.string().trim().min(1).max(120),
  email: Email,
  password: Password,
  role: UserRole,
});
export type CreateUserRequest = z.infer<typeof CreateUserRequest>;

export const UpdateUserRequest = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: Email.optional(),
    password: Password.optional(),
    role: UserRole.optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: 'Debes enviar al menos un campo para actualizar.',
  });
export type UpdateUserRequest = z.infer<typeof UpdateUserRequest>;
