export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let csrfToken: string | null = null;

export function setCsrf(token: string | null): void {
  csrfToken = token;
}

export async function api<T>(path: string, options: RequestInit & { json?: unknown } = {}) {
  const { json, body, ...rest } = options;
  const headers = new Headers(rest.headers);
  if (json !== undefined) headers.set('Content-Type', 'application/json');
  if (csrfToken && rest.credentials !== 'omit') headers.set('X-CSRF-Token', csrfToken);

  const init: RequestInit = { ...rest, headers, credentials: rest.credentials ?? 'same-origin' };
  if (json !== undefined) init.body = JSON.stringify(json);
  else if (body !== undefined && body !== null) init.body = body;

  const timeout = AbortSignal.timeout(20000);
  init.signal = rest.signal ? AbortSignal.any([rest.signal, timeout]) : timeout;
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, init);
  } catch (error) {
    if (timeout.aborted) throw new ApiError(408, 'La conexión tardó demasiado. Intenta nuevamente.');
    throw error;
  }
  if (res.status === 401 && rest.credentials !== 'omit' && path !== '/auth/login') {
    window.dispatchEvent(new Event('rokai:session-expired'));
  }

  const data: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (data as { error?: string } | null)?.error ?? 'No pudimos completar la solicitud.';
    throw new ApiError(res.status, message);
  }
  if (res.status !== 204 && data === null) throw new ApiError(502, 'No se recibió una respuesta válida. Intenta nuevamente.');
  return data as T;
}
