export interface Country {
  iso: string;
  name: string;
  dial: string;
}

/** Colombia primero: es el indicativo por defecto de la estación. */
export const COUNTRIES: Country[] = [
  { iso: 'CO', name: 'Colombia', dial: '+57' },
  { iso: 'AR', name: 'Argentina', dial: '+54' },
  { iso: 'BR', name: 'Brasil', dial: '+55' },
  { iso: 'CA', name: 'Canadá', dial: '+1' },
  { iso: 'CL', name: 'Chile', dial: '+56' },
  { iso: 'CR', name: 'Costa Rica', dial: '+506' },
  { iso: 'EC', name: 'Ecuador', dial: '+593' },
  { iso: 'ES', name: 'España', dial: '+34' },
  { iso: 'US', name: 'Estados Unidos', dial: '+1' },
  { iso: 'FR', name: 'Francia', dial: '+33' },
  { iso: 'DE', name: 'Alemania', dial: '+49' },
  { iso: 'IT', name: 'Italia', dial: '+39' },
  { iso: 'MX', name: 'México', dial: '+52' },
  { iso: 'NL', name: 'Países Bajos', dial: '+31' },
  { iso: 'PA', name: 'Panamá', dial: '+507' },
  { iso: 'PE', name: 'Perú', dial: '+51' },
  { iso: 'PT', name: 'Portugal', dial: '+351' },
  { iso: 'GB', name: 'Reino Unido', dial: '+44' },
  { iso: 'CH', name: 'Suiza', dial: '+41' },
  { iso: 'UY', name: 'Uruguay', dial: '+598' },
  { iso: 'VE', name: 'Venezuela', dial: '+58' },
];

export const DEFAULT_DIAL = '+57';

/** Longitud esperada del número nacional, para avisar antes de enviar al servidor. */
const NATIONAL_LENGTH: Record<string, number> = { '+57': 10 };

export const digitsOnly = (value: string): string => value.replace(/\D/g, '');

export function toE164(dial: string, national: string): string {
  const digits = digitsOnly(national);
  return digits === '' ? '' : `${dial}${digits}`;
}

/** Separa un E.164 guardado en borrador; elige el indicativo más largo que coincida. */
export function splitE164(value: string): { dial: string; national: string } {
  if (!value.startsWith('+')) return { dial: DEFAULT_DIAL, national: digitsOnly(value) };
  const match = [...COUNTRIES]
    .map((c) => c.dial)
    .sort((a, b) => b.length - a.length)
    .find((dial) => value.startsWith(dial));
  return match
    ? { dial: match, national: value.slice(match.length) }
    : { dial: DEFAULT_DIAL, national: digitsOnly(value) };
}

export function phoneHint(dial: string, national: string): string | null {
  const digits = digitsOnly(national);
  if (digits === '') return null;
  const expected = NATIONAL_LENGTH[dial];
  if (expected && digits.length !== expected) {
    return `Un número de ${COUNTRIES.find((c) => c.dial === dial)?.name ?? 'este país'} tiene ${expected} dígitos.`;
  }
  return null;
}
