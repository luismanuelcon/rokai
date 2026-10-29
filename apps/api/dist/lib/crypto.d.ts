/**
 * scrypt con los parámetros por defecto de Node. Se conserva del MVP porque está
 * probado y no requiere dependencias nativas. La migración a Argon2id prevista en
 * ARQUITECTURA-V2 queda pendiente; `needsRehash` ya deja el punto de enganche.
 */
export declare function hashPassword(password: string): string;
export declare function verifyPassword(password: string, stored: string): boolean;
export declare function needsRehash(stored: string): boolean;
/** Hash contra el que comparar cuando el correo no existe, para igualar tiempos. */
export declare const DUMMY_HASH: string;
export declare const sha256: (value: string) => string;
export declare const randomToken: (bytes?: number) => string;
/** Comparación en tiempo constante para tokens de igual longitud. */
export declare function safeEqual(a: string, b: string): boolean;
//# sourceMappingURL=crypto.d.ts.map