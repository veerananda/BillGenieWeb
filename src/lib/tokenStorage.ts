/**
 * Web auth token storage (Security P2).
 * - Access JWT: sessionStorage (cleared when the tab closes; reduces XSS dwell time vs localStorage)
 * - Refresh JWT: httpOnly cookie set by API (not readable by JS); legacy localStorage cleared on write
 */

const ACCESS_KEY = 'auth_token';
const REFRESH_KEY = 'refresh_token';

function migrateAccessFromLocal(): string | null {
  try {
    const legacy = localStorage.getItem(ACCESS_KEY);
    if (!legacy) return null;
    sessionStorage.setItem(ACCESS_KEY, legacy);
    localStorage.removeItem(ACCESS_KEY);
    return legacy;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  try {
    return sessionStorage.getItem(ACCESS_KEY) ?? migrateAccessFromLocal();
  } catch {
    return localStorage.getItem(ACCESS_KEY);
  }
}

export function setAccessToken(token: string): void {
  try {
    sessionStorage.setItem(ACCESS_KEY, token);
  } catch {
    localStorage.setItem(ACCESS_KEY, token);
  }
  try {
    localStorage.removeItem(ACCESS_KEY);
  } catch {
    // ignore
  }
}

export function clearAccessToken(): void {
  try {
    sessionStorage.removeItem(ACCESS_KEY);
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem(ACCESS_KEY);
  } catch {
    // ignore
  }
}

/** Legacy body refresh only — prefer httpOnly cookie. Cleared after migration. */
export function getLegacyRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function clearLegacyRefreshToken(): void {
  try {
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    // ignore
  }
}
