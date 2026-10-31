import { ApiError } from './api';

export const MAX_RENTAL_BYTES = 32 * 1024;
const MAX_SIGNATURE_BYTES = 20 * 1024;
export const jsonBytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

/** Reduce la imagen completa, sin recortar trazos ni depender de la densidad de pantalla. */
export async function prepareSignature(value: string): Promise<string> {
  if (!/^data:image\/png;base64,/.test(value))
    throw new Error('Pide al cliente que firme antes de confirmar.');
  if (value.length <= MAX_SIGNATURE_BYTES) return value;
  const image = new Image();
  image.src = value;
  try {
    await image.decode();
  } catch {
    throw new Error('No pudimos leer la firma. Bórrala y pide al cliente que vuelva a firmar.');
  }
  for (const maxWidth of [640, 480, 360]) {
    const scale = Math.min(1, maxWidth / image.width, 240 / image.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo preparar la firma. Reintenta sin cerrar esta página.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = canvas.toDataURL('image/png');
    if (png.length <= MAX_SIGNATURE_BYTES) return png;
  }
  throw new Error(
    'La firma sigue ocupando demasiado. Bórrala y pide al cliente que vuelva a firmar. Los demás datos se conservan.',
  );
}

export function rentalError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 413)
      return 'El servidor rechazó el tamaño del registro. Borra la firma y vuelve a capturarla; los demás datos se conservan.';
    if (error.status === 401 || error.status === 403)
      return 'La sesión venció o no tienes permiso. Verifica tu acceso antes de reintentar; conserva esta página abierta.';
    if (error.status === 409)
      return `${error.message} Revisa la disponibilidad de equipos antes de reintentar.`;
    if (error.status === 429)
      return 'Hay demasiados intentos. Espera un momento y vuelve a confirmar.';
    if (error.status >= 500)
      return 'No pudimos confirmar la respuesta del servidor. Conserva esta página y reintenta: se usará el mismo identificador para evitar duplicados.';
  }
  if (error instanceof TypeError)
    return 'No pudimos conectar con el servidor. Revisa tu conexión y reintenta sin cerrar esta página; tus datos y firma se conservan.';
  return error instanceof Error
    ? error.message
    : 'No se pudo registrar el alquiler. Conserva esta página y reintenta.';
}
