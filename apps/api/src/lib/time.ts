const BOGOTA = 'America/Bogota';

/** Fecha civil en Bogotá, usada para la vigencia de tarifas. */
export function todayInBogota(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BOGOTA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

export function addMinutes(from: Date, minutes: number): Date {
  return new Date(from.getTime() + minutes * 60_000);
}
