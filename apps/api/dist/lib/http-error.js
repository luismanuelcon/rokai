/** Error de negocio con código HTTP. Cualquier otra excepción produce 500 genérico. */
export class HttpError extends Error {
    status;
    code;
    constructor(status, message, code) {
        super(message);
        this.status = status;
        this.code = code;
        this.name = 'HttpError';
    }
}
export const badRequest = (m, code) => new HttpError(400, m, code);
export const unauthorized = (m) => new HttpError(401, m);
export const forbidden = (m) => new HttpError(403, m);
export const notFound = (m) => new HttpError(404, m);
export const conflict = (m, code) => new HttpError(409, m, code);
export const tooMany = (m) => new HttpError(429, m);
//# sourceMappingURL=http-error.js.map