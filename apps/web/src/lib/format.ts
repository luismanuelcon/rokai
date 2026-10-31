const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/** Los importes viajan en centavos para no perder precisión. */
export const money = (cents: number): string => COP.format(cents / 100);

/**
 * Vista previa del recargo por retraso. El cálculo autoritativo vive en el
 * servidor (`domain/rentals.ts`); aquí solo se anticipa para que el
 * colaborador sepa qué va a cobrar. Minuto empezado, minuto cobrado.
 */
export function lateCharge(
  dueAt: string,
  perMinuteCents: number,
): { minutes: number; cents: number } {
  const overdueMs = Date.now() - new Date(dueAt).getTime();
  if (overdueMs <= 0) return { minutes: 0, cents: 0 };
  const minutes = Math.ceil(overdueMs / 60_000);
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

export const minutesLeft = (dueAt: string): number =>
  Math.round((new Date(dueAt).getTime() - Date.now()) / 60_000);
