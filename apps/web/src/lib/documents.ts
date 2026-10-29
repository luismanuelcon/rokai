import type { DocumentType } from '@rokai/contracts';

export const DOCUMENT_TYPES: { value: DocumentType; label: string; short: string }[] = [
  { value: 'CC', label: 'Cédula de ciudadanía', short: 'C.C.' },
  { value: 'CE', label: 'Cédula de extranjería', short: 'C.E.' },
  { value: 'TI', label: 'Tarjeta de identidad', short: 'T.I.' },
  { value: 'PA', label: 'Pasaporte', short: 'Pasaporte' },
  { value: 'PEP', label: 'Permiso Especial de Permanencia', short: 'PEP' },
  { value: 'PPT', label: 'Permiso por Protección Temporal', short: 'PPT' },
];

export const DEFAULT_DOCUMENT_TYPE: DocumentType = 'CC';

export const documentShort = (type: string): string =>
  DOCUMENT_TYPES.find((d) => d.value === type)?.short ?? type;
