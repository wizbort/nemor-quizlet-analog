# Nemor Cards — API & Data Contract

This document governs every phase. The single Cloudflare Worker serves both the
Expo web export (Static Assets, SPA fallback) and a `/api` BFF. D1 is the source
of truth; the client caches locally (Dexie on web, expo-sqlite on native) and
syncs. There is exactly **one origin** (the Worker serves both the app and the
API), so **no CORS** is required.

---

## Shared domain types

These types are duplicated verbatim in `worker/src/types.ts` and
`app/src/types.ts`. Keep them in sync.

```ts
interface Deck {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  createdAt: number;   // epoch ms
  updatedAt: number;   // epoch ms
  deleted: 0 | 1;      // soft delete
}

interface Card {
  id: string;
  deckId: string;
  userId: string;
  front: string;
  back: string;
  // ts-fsrs scheduling fields
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number;            // 0=New 1=Learning 2=Review 3=Relearning
  last_review: number | null;
  createdAt: number;
  updatedAt: number;
  deleted: 0 | 1;
}

interface ReviewLog {
  id: string;
  cardId: string;
  userId: string;
  rating: number;           // 1=Again 2=Hard 3=Good 4=Easy
  state: number;
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  last_elapsed_days: number;
  scheduled_days: number;
  reviewedAt: number;
}

interface QuizQuestion {
  id: string;
  type: 'mcq' | 'short';
  prompt: string;
  options?: string[];
  answerIndex?: number;
  answer?: string;
  explanation?: string;
}

interface AuthUser {
  id: string;
  phone?: string | null;
  email?: string | null;
}

interface SyncPayload {
  decks: Deck[];
  cards: Card[];
  reviews: ReviewLog[];
}

interface SyncPullResult extends SyncPayload {
  now: number;
}
```

---

## Conventions

- All requests/responses are JSON unless noted (`/api/recognize` accepts
  multipart or raw bytes).
- Base path: `/api`.
- Auth: `Authorization: Bearer <session>` on **everything except**
  `/api/health`, `/api/auth/login`, `/api/auth/verify`.
- Timestamps are epoch **milliseconds** (`INTEGER` in D1).
- Soft delete via `deleted` (`0`/`1`); deletes are propagated, never hard
  removed, so sync can converge.

---

## Endpoints

### `GET /api/health`
No auth. → `{ ok: true }`

### `POST /api/auth/login`
No auth. Body `{ phone }`.
Proxies to `AUTH_API_BASE_URL` `POST /auth/login` with header
`X-API-Key: AUTH_API_KEY` and body `{ phone, provider: 'telegram' }`.
Returns upstream JSON, e.g. `{ success, expiresAt, telegram? }`.

### `POST /api/auth/verify`
No auth. Body `{ phone, code }`.
Proxies to `POST /auth/verify` with body `{ phone, code, provider: 'telegram' }`
and `X-API-Key`. Returns `{ success, session, user }`.

### `GET /api/auth/session`
Bearer. Proxies to `GET /auth/session` with `X-API-Key` +
`Authorization: Bearer <session>`. Returns `{ success, user, expiresAt }`.

### `POST /api/auth/logout`
Bearer. Proxies to `DELETE /auth/session`. Returns `{ success }`.

### `GET /api/sync?since=<ms>`
Bearer. Validates the session, then returns a `SyncPullResult` containing rows
where `updated_at` (decks/cards) or `reviewed_at` (reviews) is `> since` for the
authenticated user. `now = Date.now()`.

### `POST /api/sync`
Bearer. Body is a `SyncPayload`. Validates the session, upserts every row with
**last-write-wins by `updatedAt`**, force `user_id = session user id` on all
rows, then returns `{ ok: true, now }`.

### `POST /api/recognize`
Bearer. Body is either `multipart/form-data` with a `file` field (a PDF) **or**
raw bytes with `?name=<filename>`. Calls
`env.AI.toMarkdown([{ name, blob }])` and returns `{ markdown }`.

### `POST /api/cards/generate`
Bearer. Body `{ text, count?, deckTitle? }`. Calls the LLM (`chatJSON`) and
returns `{ cards: [{ front, back }] }`.

### `POST /api/quiz`
Bearer. Body `{ deckId?, cards?: [{ front, back }], count?, types? }`. Calls the
LLM (`chatJSON`) and returns `{ questions: QuizQuestion[] }`.

### `POST /api/quiz/grade`
Bearer. Body `{ question, userAnswer }`. Calls the LLM and returns
`{ correct: boolean, feedback: string }`.

---

## LLM transport

POST to `OPENROUTER_PROXY_URL + '/v1/chat/completions'` with header
`Authorization: Bearer OPENROUTER_PROXY_KEY`, OpenAI-compatible body:

```json
{ "model": "...", "messages": [...], "temperature": 0.x, "max_tokens": 1234 }
```

Try the models in `LLM_MODELS` (comma-separated) **in order** until one returns
usable content. Parse JSON tolerantly — extract the first `{...}` or `[...]`
block from the completion text.

> Note: the exact proxy path (`/v1/chat/completions`) may need adjustment to
> match the deployed OpenRouter proxy.

---

## Spaced repetition

Scheduling runs **client-side** via `ts-fsrs`. The Worker only stores the FSRS
fields and review logs; it never schedules. On each review the client computes
the next FSRS state and pushes both the updated card and a `ReviewLog`.

---

## Environment / secrets

| Name | Where | Notes |
|------|-------|-------|
| `AUTH_API_BASE_URL` | `wrangler.toml [vars]` | alrevion auth-api base |
| `OPENROUTER_PROXY_URL` | `wrangler.toml [vars]` | OpenRouter-compatible proxy |
| `LLM_MODELS` | `wrangler.toml [vars]` | comma-separated fallback order |
| `AUTH_API_KEY` | **secret** | `wrangler secret put` / `.dev.vars` |
| `OPENROUTER_PROXY_KEY` | **secret** | `wrangler secret put` / `.dev.vars` |

`AUTH_API_KEY` must be created in the alrevion auth-api (a `client` + an
`api_keys` row). `OPENROUTER_PROXY_KEY` is the OpenRouter proxy key.
