/** Formato de entrada colombiano: puntos de miles y coma decimal. */
export function formatCopInput(value: string): string {
  const clean = value.replace(/[^\d,]/g, '');
  const [whole = '', decimal] = clean.split(',');
  const grouped = whole.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return grouped + (decimal !== undefined ? `,${decimal.slice(0, 2)}` : '');
}
export function copCents(value: string): number | null {
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{0,2})?$/.test(value)) return null;
  const [whole = '0', fraction = ''] = value.replace(/\./g, '').split(',');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(result) && result <= 1_000_000_000 ? result : null;
}
export function centsToInput(value: number): string {
  return formatCopInput((value / 100).toFixed(2).replace('.', ',').replace(/,00$/, ''));
}
