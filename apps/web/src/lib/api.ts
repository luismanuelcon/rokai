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
  if (csrfToken) headers.set('X-CSRF-Token', csrfToken);

  const init: RequestInit = { ...rest, headers, credentials: 'same-origin' };
  if (json !== undefined) init.body = JSON.stringify(json);
  else if (body !== undefined && body !== null) init.body = body;

  const res = await fetch(`/api/v1${path}`, init);

  const data: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (data as { error?: string } | null)?.error ?? 'No pudimos completar la solicitud.';
    throw new ApiError(res.status, message);
  }
  return data as T;
}
