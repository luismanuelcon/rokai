import { z } from 'zod';
import { Cents, Id, IsoDate } from './common.js';
import { EquipmentKind, EquipmentStatus, RatePeriod } from './enums.js';

export const Rate = z.object({
  id: Id,
  period: RatePeriod,
  minutes: z.number().int().min(1).max(480),
  quantity: z.number().int().min(1).max(2),
  priceCents: Cents,
  active: z.boolean(),
  validFrom: IsoDate.nullable(),
  validUntil: IsoDate.nullable(),
});
export type Rate = z.infer<typeof Rate>;

const dateRangeIsOrdered = (v: { validFrom?: string | null; validUntil?: string | null }) =>
  !v.validFrom || !v.validUntil || v.validFrom <= v.validUntil;
const dateRangeError = {
  message: 'La fecha final debe ser igual o posterior a la inicial.',
  path: ['validUntil'],
};

export const CreateRateRequest = z
  .object({
    period: RatePeriod,
    minutes: z.number().int().min(1).max(480),
    quantity: z.number().int().min(1).max(2),
    priceCents: Cents,
    validFrom: IsoDate.nullable().default(null),
    validUntil: IsoDate.nullable().default(null),
  })
  .refine(dateRangeIsOrdered, dateRangeError);
export type CreateRateRequest = z.infer<typeof CreateRateRequest>;

export const UpdateRateRequest = z
  .object({
    priceCents: Cents,
    active: z.boolean(),
    validFrom: IsoDate.nullable().default(null),
    validUntil: IsoDate.nullable().default(null),
  })
  .refine(dateRangeIsOrdered, dateRangeError);
export type UpdateRateRequest = z.infer<typeof UpdateRateRequest>;

export const Equipment = z.object({
  id: Id,
  code: z.string(),
  kind: EquipmentKind,
  status: EquipmentStatus,
  busy: z.boolean(),
});
export type Equipment = z.infer<typeof Equipment>;

export const CreateEquipmentRequest = z.object({
  code: z.string().trim().min(1).max(30),
  kind: EquipmentKind,
});
export type CreateEquipmentRequest = z.infer<typeof CreateEquipmentRequest>;

export const UpdateEquipmentRequest = z.object({
  status: EquipmentStatus,
});
export type UpdateEquipmentRequest = z.infer<typeof UpdateEquipmentRequest>;
