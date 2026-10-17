import { Hono } from 'hono';
import type { Env } from '../types';
import {
  otpLogin,
  otpVerify,
  getSession,
  logout,
  getBearer,
  invalidateSession,
} from '../lib/authClient';

// Auth proxy router. Proxies Telegram OTP to the alrevion auth-api.
//   POST /api/auth/login    { phone }            (PUBLIC)
//   POST /api/auth/verify   { phone, code }      (PUBLIC)
//   GET  /api/auth/session  (Bearer)
//   POST /api/auth/logout   (Bearer)
// Upstream JSON and status codes are forwarded faithfully.
export const authRouter = new Hono<{ Bindings: Env }>();

// POST /login — public. Body { phone }.
authRouter.post('/login', async (c) => {
  const body = await c.req.json<{ phone?: string }>().catch(() => ({} as any));
  if (!body.phone || typeof body.phone !== 'string') {
    return c.json({ error: { code: 'bad_request', message: 'phone is required' } }, 400);
  }
  const { status, json } = await otpLogin(c.env, body.phone);
  return c.json(json ?? {}, status as any);
});

// POST /verify — public. Body { phone, code }.
authRouter.post('/verify', async (c) => {
  const body = await c
    .req.json<{ phone?: string; code?: string }>()
    .catch(() => ({} as any));
  if (!body.phone || !body.code) {
    return c.json(
      { error: { code: 'bad_request', message: 'phone and code are required' } },
      400,
    );
  }
  const { status, json } = await otpVerify(c.env, body.phone, body.code);
  return c.json(json ?? {}, status as any);
});

// GET /session — requires a Bearer token; proxied upstream with X-API-Key.
authRouter.get('/session', async (c) => {
  const token = getBearer(c);
  if (!token) {
    return c.json({ error: { code: 'unauthorized', message: 'missing bearer token' } }, 401);
  }
  const { status, json } = await getSession(c.env, token);
  return c.json(json ?? {}, status as any);
});

// POST /logout — requires a Bearer token; proxied to DELETE /auth/session.
authRouter.post('/logout', async (c) => {
  const token = getBearer(c);
  if (!token) {
    return c.json({ error: { code: 'unauthorized', message: 'missing bearer token' } }, 401);
  }
  const { status, json } = await logout(c.env, token);
  invalidateSession(token); // drop any cached validation for this token
  return c.json(json ?? { success: true }, status as any);
});
