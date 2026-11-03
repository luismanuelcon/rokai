import { z } from 'zod';
export const ClosingDate = z.iso.date('Selecciona una fecha válida.');
const Clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Ingresa una hora válida.');
const Amount = z.number().int().min(0).max(1_000_000_000);
const fields = {
    date: ClosingDate,
    opensAt: Clock,
    closesAt: Clock,
    closesNextDay: z.boolean().default(false),
    cashCents: Amount,
    transferCents: Amount,
    expenses: z
        .array(z.object({
        description: z.string().trim().min(1, 'Describe el gasto.').max(160),
        amountCents: Amount.positive('El gasto debe ser mayor que cero.'),
    }))
        .max(40),
    notes: z.string().trim().max(2000).default(''),
};
const validHours = (v) => v.closesNextDay ? v.closesAt <= v.opensAt : v.closesAt > v.opensAt;
const hoursError = {
    message: 'Revisa el horario: la jornada debe durar entre un minuto y 24 horas. Marca si termina al día siguiente.',
    path: ['closesAt'],
};
export const CreateDayClosingRequest = z.object(fields).refine(validHours, hoursError);
export const UpdateDayClosingRequest = z
    .object({ ...fields, version: z.number().int().positive() })
    .refine(validHours, hoursError);
//# sourceMappingURL=dayClosings.js.map