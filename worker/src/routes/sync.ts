import { Hono } from 'hono';
import type { Env, SyncPayload, SyncPullResult } from '../types';
import { requireUser } from '../lib/authClient';
import { getChangedSince, applyChanges } from '../lib/d1';

// Sync router (Bearer). Both routes validate the session and scope by user.id.
//   GET  /api/sync?since=<ms>  -> SyncPullResult (rows changed strictly after)
//   POST /api/sync             -> body SyncPayload, last-write-wins upsert
export const syncRouter = new Hono<{ Bindings: Env }>();

// GET / — pull rows changed since `?since` (defaults to 0 = full pull).
syncRouter.get('/', async (c) => {
  const user = await requireUser(c);

  const sinceRaw = c.req.query('since');
  let since = sinceRaw == null ? 0 : Number(sinceRaw);
  if (!Number.isFinite(since) || since < 0) since = 0;

  const payload = await getChangedSince(c.env.DB, user.id, since);
  const result: SyncPullResult = { ...payload, now: Date.now() };
  return c.json(result);
});

// POST / — push a SyncPayload; user_id is forced server-side to user.id.
syncRouter.post('/', async (c) => {
  const user = await requireUser(c);

  const body = await c.req.json<Partial<SyncPayload>>().catch(() => null);
  if (!body || typeof body !== 'object') {
    return c.json({ error: { code: 'bad_request', message: 'invalid JSON body' } }, 400);
  }

  const payload: SyncPayload = {
    decks: Array.isArray(body.decks) ? body.decks : [],
    cards: Array.isArray(body.cards) ? body.cards : [],
    reviews: Array.isArray(body.reviews) ? body.reviews : [],
  };

  await applyChanges(c.env.DB, user.id, payload);
  return c.json({ ok: true, now: Date.now() });
});
