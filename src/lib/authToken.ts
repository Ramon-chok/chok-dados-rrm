/** Persistência e leitura do JWT do usuário. Páginas usam via api.ts (Bearer automático). */

export const AUTH_TOKEN_KEY = 'chok_auth_token';
export const AUTH_EXPIRES_KEY = 'chok_auth_expires_at';

export interface StoredAuthToken {
  token: string;
  expiresAt: number | null; // epoch ms
  rememberMe: boolean;
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function getTokenExpiresAt(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(AUTH_EXPIRES_KEY) || sessionStorage.getItem(AUTH_EXPIRES_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function isTokenExpired(skewMs = 30_000): boolean {
  const exp = getTokenExpiresAt();
  if (!exp) return false; // sem exp explícito: deixa o backend validar
  return Date.now() >= exp - skewMs;
}

export function storeAuthToken(token: string, expiresInSeconds?: number, rememberMe = true): void {
  const storage = rememberMe ? localStorage : sessionStorage;
  const other = rememberMe ? sessionStorage : localStorage;
  storage.setItem(AUTH_TOKEN_KEY, token);
  other.removeItem(AUTH_TOKEN_KEY);

  if (expiresInSeconds && expiresInSeconds > 0) {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    storage.setItem(AUTH_EXPIRES_KEY, String(expiresAt));
    other.removeItem(AUTH_EXPIRES_KEY);
  } else {
    storage.removeItem(AUTH_EXPIRES_KEY);
    other.removeItem(AUTH_EXPIRES_KEY);
  }
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_EXPIRES_KEY);
  sessionStorage.removeItem(AUTH_EXPIRES_KEY);
  localStorage.removeItem('chok_auth_user_id');
  sessionStorage.removeItem('chok_auth_user_id');
}

export function authHeader(): Record<string, string> {
  const token = getStoredToken();
  if (!token || isTokenExpired()) return {};
  return { Authorization: `Bearer ${token}` };
}

/** Decodifica payload JWT (sem validar assinatura) — útil para UI. */
export function peekJwtPayload(token?: string | null): Record<string, unknown> | null {
  const t = token ?? getStoredToken();
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
