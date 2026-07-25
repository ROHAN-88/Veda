/**
 * Same-origin API client. All requests go through the Vite/`reverse-proxy` `/api`
 * prefix with credentials, so the HttpOnly session cookie flows automatically.
 *
 * CSRF: mutations carry an `X-CSRF-Token` header (double-submit). The token is
 * session-bound, so after an auth-state change it can go stale — a 403 triggers a
 * single token refresh + retry.
 */
const API_BASE = '/api';

interface ApiErrorBody {
  message?: string | string[];
}

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

async function refreshCsrfToken(): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
  if (!res.ok) {
    throw new ApiError(res.status, 'Failed to obtain CSRF token');
  }
  const body = (await res.json()) as { csrfToken: string };
  csrfToken = body.csrfToken;
}

function isMutation(method: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

async function send(
  path: string,
  options: RequestInit,
  allowCsrfRetry: boolean,
): Promise<Response> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  if (isMutation(method)) {
    if (!csrfToken) {
      await refreshCsrfToken();
    }
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }
    if (options.body != null && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' });
  if (res.status === 403 && isMutation(method) && allowCsrfRetry) {
    await refreshCsrfToken();
    return send(path, options, false);
  }
  return res;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await send(path, options, true);
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as ApiErrorBody;
      if (body.message) {
        message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      }
    } catch {
      // non-JSON error body — keep the status text
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export function apiJson<T>(path: string, method: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong';
}
