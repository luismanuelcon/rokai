const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/** Los importes viajan en centavos para no perder precisión. */
export const money = (cents: number): string => COP.format(cents / 100);

const BOGOTA = 'America/Bogota';
const BOGOTA_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: BOGOTA,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export const toBogotaTime = (iso: string): string => BOGOTA_TIME.format(new Date(iso));

function minutesOfDay(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/**
 * Vista previa del recargo por retraso. El cálculo autoritativo vive en el
 * servidor (`domain/rentals.ts`); aquí se compara solo la hora de Bogotá.
 */
export function lateCharge(
  dueAt: string,
  returnTime: string,
  perMinuteCents: number,
): { minutes: number; cents: number } {
  const dueMinutes = minutesOfDay(toBogotaTime(dueAt));
  const returnedMinutes = minutesOfDay(returnTime);
  if (dueMinutes === null || returnedMinutes === null) return { minutes: 0, cents: 0 };
  const minutes = Math.max(0, returnedMinutes - dueMinutes);
  return { minutes, cents: perMinuteCents > 0 ? minutes * perMinuteCents : 0 };
}

const DATE_TIME = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export const datetime = (iso: string): string => DATE_TIME.format(new Date(iso));

const TIME = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  hour: '2-digit',
  minute: '2-digit',
});

export const time = (iso: string): string => TIME.format(new Date(iso));

export const minutesLeft = (dueAt: string): number =>
  Math.round((new Date(dueAt).getTime() - Date.now()) / 60_000);
