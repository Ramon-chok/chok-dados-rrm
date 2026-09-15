/** Persistência e leitura do JWT do usuário. Páginas usam via api.ts (Bearer automático). */

export const AUTH_TOKEN_KEY = 'chok_auth_token';
export const AUTH_EXPIRES_KEY = 'chok_auth_expires_at';
export const AUTH_COOKIE_NAME = 'chok_auth_token';

export interface StoredAuthToken {
  token: string;
  expiresAt: number | null; // epoch ms
  rememberMe: boolean;
}

export function getStoredToken(): string | null {
  // When using HttpOnly cookies we cannot access the token from JS.
  // Return null to force server-side validation via cookie.
  return null;
}

export function getTokenExpiresAt(): number | null {
  return null;
}

export function isTokenExpired(skewMs = 30_000): boolean {
  // Without access to token exp in JS (HttpOnly cookie), rely on backend for expiration.
  return false;
}

export function storeAuthToken(token: string, expiresInSeconds?: number, rememberMe = true): void {
  // No-op: cookie is HttpOnly and set by the backend. Keep function for compatibility.
}

export function clearAuthToken(): void {
  // Remove any legacy client-side storage keys (if present).
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_EXPIRES_KEY);
    sessionStorage.removeItem(AUTH_EXPIRES_KEY);
    localStorage.removeItem('chok_auth_user_id');
    sessionStorage.removeItem('chok_auth_user_id');
  } catch {
    // ignore (e.g. SSR or restricted env)
  }
}

function getCookie(name: string): string | null {
  return null;
}

function setCookie(name: string, value: string, opts?: { expires?: string }) {
  // intentionally noop: avoid JS cookie operations for HttpOnly tokens
}

function deleteCookie(name: string) {
  // intentionally noop for HttpOnly cookie
}

export function authHeader(): Record<string, string> {
  // Using HttpOnly cookie for auth; do not send Authorization header from the client.
  return {};
}

/** Decodifica payload JWT (sem validar assinatura) — útil para UI. */
export function peekJwtPayload(token?: string | null): Record<string, unknown> | null {
  const t = token ?? null;
  if (!t) return null;
  const parts = t.split('.');
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(b64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}
