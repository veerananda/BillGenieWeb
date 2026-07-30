/**
 * Web auth token storage (Security P2 → hardened).
 * - Access JWT: in-memory only (not readable after XSS via sessionStorage/localStorage)
 * - Refresh JWT: httpOnly cookie set by API (not readable by JS)
 * - Session restore: cookie refresh on app bootstrap (see SessionBootstrap)
 */

const ACCESS_KEY = 'auth_token';
const REFRESH_KEY = 'refresh_token';

let memoryAccessToken: string | null = null;

function scrubPersistedAccessTokens(): void {
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

/** One-time scrub of legacy persisted access JWTs on module load. */
scrubPersistedAccessTokens();

export function getAccessToken(): string | null {
  return memoryAccessToken;
}

export function setAccessToken(token: string): void {
  memoryAccessToken = token;
  scrubPersistedAccessTokens();
}

export function clearAccessToken(): void {
  memoryAccessToken = null;
  scrubPersistedAccessTokens();
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
