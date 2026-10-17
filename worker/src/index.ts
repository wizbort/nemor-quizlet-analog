import { Hono } from 'hono';
import type { Env } from './types';
import { apiRouter } from './routes/index';

// Single-origin Worker: it serves both the Expo web export (Static Assets, SPA
// fallback via the ASSETS binding) AND the /api BFF. Because there is exactly
// one origin, no CORS is required.
//
// If you ever need to handle preflight requests (e.g. a separate native dev
// origin), add an OPTIONS passthrough here, e.g.:
//   app.options('/api/*', (c) => c.body(null, 204));
// For now it is intentionally omitted (same-origin only).

const app = new Hono<{ Bindings: Env }>();

app.route('/api', apiRouter);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    // Route the API namespace (exactly /api or any /api/* path) to Hono.
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return app.fetch(request, env, ctx);
    }
    // Everything else: static assets + SPA fallback (not_found_handling).
    return env.ASSETS.fetch(request);
  },
};
