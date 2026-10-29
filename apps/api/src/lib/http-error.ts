/** Error de negocio con código HTTP. Cualquier otra excepción produce 500 genérico. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (m: string, code?: string) => new HttpError(400, m, code);
export const unauthorized = (m: string) => new HttpError(401, m);
export const forbidden = (m: string) => new HttpError(403, m);
export const notFound = (m: string) => new HttpError(404, m);
export const conflict = (m: string, code?: string) => new HttpError(409, m, code);
export const tooMany = (m: string) => new HttpError(429, m);
