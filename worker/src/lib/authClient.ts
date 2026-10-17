import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Env, AuthUser } from '../types';

// Client for the alrevion auth-api (Telegram OTP).
// All calls send header X-API-Key: AUTH_API_KEY to AUTH_API_BASE_URL.
// session/logout additionally send Authorization: Bearer <sessionToken>.

export interface LoginResult {
  success: boolean;
  expiresAt?: number;
  telegram?: unknown;
  [k: string]: unknown;
}

export interface VerifyResult {
  success: boolean;
  session: string;
  user: AuthUser;
  [k: string]: unknown;
}

export interface SessionResult {
  success: boolean;
  user: AuthUser;
  expiresAt?: number;
  [k: string]: unknown;
}

/** Build the absolute auth-api URL for a given path (handles trailing slash). */
function authUrl(env: Env, path: string): string {
  return env.AUTH_API_BASE_URL.replace(/\/+$/, '') + path;
}

/**
 * Perform a JSON request to the auth-api. Always sends X-API-Key; optionally a
 * Bearer token. Returns the parsed JSON body plus the HTTP status so callers can
 * faithfully forward upstream status codes.
 */
async function authFetch(
  env: Env,
  method: string,
  path: string,
  body?: unknown,
  sessionToken?: string,
): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = {
    'X-API-Key': env.AUTH_API_KEY,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (sessionToken) headers['Authorization'] = 'Bearer ' + sessionToken;

  const res = await fetch(authUrl(env, path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Parse tolerantly: upstream should return JSON, but guard against empty/HTML.
  let json: any = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { success: false, error: text };
    }
  }
  return { status: res.status, json };
}

/** POST /auth/login { phone, provider:'telegram' }. */
export async function otpLogin(
  env: Env,
  phone: string,
): Promise<{ status: number; json: LoginResult }> {
  return authFetch(env, 'POST', '/auth/login', { phone, provider: 'telegram' });
}

/** POST /auth/verify { phone, code, provider:'telegram' }. */
export async function otpVerify(
  env: Env,
  phone: string,
  code: string,
): Promise<{ status: number; json: VerifyResult }> {
  return authFetch(env, 'POST', '/auth/verify', {
    phone,
    code,
    provider: 'telegram',
  });
}

/** GET /auth/session with Authorization: Bearer <session>. */
export async function getSession(
  env: Env,
  sessionToken: string,
): Promise<{ status: number; json: SessionResult }> {
  return authFetch(env, 'GET', '/auth/session', undefined, sessionToken);
}

/** DELETE /auth/session with Authorization: Bearer <session>. */
export async function logout(
  env: Env,
  sessionToken: string,
): Promise<{ status: number; json: { success: boolean } }> {
  return authFetch(env, 'DELETE', '/auth/session', undefined, sessionToken);
}

// --- Session validation cache -------------------------------------------------
// Cache token -> user for a short TTL to cut latency on hot paths (sync/ai).
// Always re-validate against the auth-api once the entry expires.
const SESSION_TTL_MS = 60_000;
interface CacheEntry {
  user: AuthUser;
  expires: number;
}
const sessionCache = new Map<string, CacheEntry>();

/** Extract the raw Bearer token from the incoming request, or null. */
function readBearer(c: Context): string | null {
  const header = c.req.header('Authorization') || c.req.header('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/** Throw a JSON 401 (handled by app.onError as { error: { code, message } }). */
function unauthorized(message: string): never {
  throw new HTTPException(401, {
    res: Response.json({ error: { code: 'unauthorized', message } }, { status: 401 }),
  });
}

/**
 * Hono helper: validate the Bearer session and return the authenticated user.
 * Throws a 401 JSON response when the header is missing or the session invalid.
 * Valid sessions are cached for SESSION_TTL_MS keyed by token.
 */
export async function requireUser(
  c: Context<{ Bindings: Env }>,
): Promise<AuthUser> {
  const token = readBearer(c);
  if (!token) unauthorized('missing bearer token');

  // Fast path: serve from cache while the entry is still fresh.
  const now = Date.now();
  const cached = sessionCache.get(token);
  if (cached && cached.expires > now) return cached.user;
  if (cached) sessionCache.delete(token); // expired -> drop and re-validate

  const { status, json } = await getSession(c.env, token);
  if (status !== 200 || !json || json.success !== true || !json.user?.id) {
    unauthorized('invalid or expired session');
  }

  const user: AuthUser = {
    id: json.user.id,
    phone: json.user.phone ?? null,
    email: json.user.email ?? null,
  };
  sessionCache.set(token, { user, expires: now + SESSION_TTL_MS });
  return user;
}

/** Drop a token from the validation cache (used on logout). */
export function invalidateSession(token: string): void {
  sessionCache.delete(token);
}

/** Read the raw Bearer token (exported for routes that proxy it upstream). */
export function getBearer(c: Context): string | null {
  return readBearer(c);
}
