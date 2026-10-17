import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Env } from '../types';
import { authRouter } from './auth';
import { syncRouter } from './sync';
import { aiRouter } from './ai';

// Top-level /api router. Wires the sub-routers and a JSON error handler.
// Paths (mounted under /api by index.ts):
//   GET  /api/health
//   *    /api/auth/*            (auth proxy)
//   *    /api/sync              (sync)
//   POST /api/recognize, /api/cards/generate, /api/quiz, /api/quiz/grade (ai)
export const apiRouter = new Hono<{ Bindings: Env }>();

// Liveness check — no auth.
apiRouter.get('/health', (c) => c.json({ ok: true }));

apiRouter.route('/auth', authRouter);
apiRouter.route('/sync', syncRouter);
// AI routes live at the root of /api so paths are /api/recognize etc.
apiRouter.route('/', aiRouter);

// Unmatched /api/* -> JSON 404.
apiRouter.notFound((c) =>
  c.json({ error: { code: 'not_found', message: 'route not found' } }, 404),
);

// Central JSON error handler. requireUser throws HTTPException(401) with a
// ready-made JSON response; everything else becomes a 500 with a stable shape.
apiRouter.onError((err, c) => {
  if (err instanceof HTTPException) {
    // requireUser attaches a ready-made JSON Response; getResponse() returns it
    // (or a default Response for bare HTTPExceptions).
    if (err.res) return err.getResponse();
    return c.json(
      { error: { code: 'http_error', message: err.message } },
      err.status,
    );
  }
  console.error('API error:', err);
  return c.json(
    { error: { code: 'internal_error', message: (err as Error)?.message ?? 'internal error' } },
    500,
  );
});
