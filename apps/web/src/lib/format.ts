const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/** Los importes viajan en centavos para no perder precisión. */
export const money = (cents: number): string => COP.format(cents / 100);

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
