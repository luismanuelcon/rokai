/** Error de negocio con código HTTP. Cualquier otra excepción produce 500 genérico. */
export declare class HttpError extends Error {
    readonly status: number;
    readonly code?: string | undefined;
    constructor(status: number, message: string, code?: string | undefined);
}
export declare const badRequest: (m: string, code?: string) => HttpError;
export declare const unauthorized: (m: string) => HttpError;
export declare const forbidden: (m: string) => HttpError;
export declare const notFound: (m: string) => HttpError;
export declare const conflict: (m: string, code?: string) => HttpError;
export declare const tooMany: (m: string) => HttpError;
//# sourceMappingURL=http-error.d.ts.map