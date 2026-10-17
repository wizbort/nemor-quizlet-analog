import type { Deck, Card, ReviewLog, SyncPayload } from '../types';

// D1 data-access layer.
// Row <-> domain mapping (snake_case columns <-> camelCase fields) happens here.
// NOTE: Card flattens the ts-fsrs fields using the SAME names as the DB columns
// (due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses,
// state, last_review), so those map 1:1.

// ---------------------------------------------------------------------------
// Row -> domain mappers
// ---------------------------------------------------------------------------

function rowToDeck(r: any): Deck {
  return {
    id: r.id,
    userId: r.user_id,
    title: r.title,
    description: r.description ?? null,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    deleted: (r.deleted ? 1 : 0) as 0 | 1,
  };
}

function rowToCard(r: any): Card {
  return {
    id: r.id,
    deckId: r.deck_id,
    userId: r.user_id,
    front: r.front,
    back: r.back,
    // FSRS fields share column names with the domain type.
    due: Number(r.due),
    stability: Number(r.stability),
    difficulty: Number(r.difficulty),
    elapsed_days: Number(r.elapsed_days),
    scheduled_days: Number(r.scheduled_days),
    reps: Number(r.reps),
    lapses: Number(r.lapses),
    state: Number(r.state),
    last_review: r.last_review == null ? null : Number(r.last_review),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    deleted: (r.deleted ? 1 : 0) as 0 | 1,
  };
}

function rowToReview(r: any): ReviewLog {
  return {
    id: r.id,
    cardId: r.card_id,
    userId: r.user_id,
    rating: Number(r.rating),
    state: Number(r.state),
    due: Number(r.due),
    stability: Number(r.stability),
    difficulty: Number(r.difficulty),
    elapsed_days: Number(r.elapsed_days),
    last_elapsed_days: Number(r.last_elapsed_days),
    scheduled_days: Number(r.scheduled_days),
    reviewedAt: Number(r.reviewed_at),
  };
}

// ---------------------------------------------------------------------------
// Pull: rows changed strictly after `since` (ms) for a single user.
// ---------------------------------------------------------------------------

export async function getChangedSince(
  db: D1Database,
  userId: string,
  since: number,
): Promise<SyncPayload> {
  const [deckRes, cardRes, reviewRes] = await db.batch([
    db
      .prepare('SELECT * FROM decks WHERE user_id = ? AND updated_at > ?')
      .bind(userId, since),
    db
      .prepare('SELECT * FROM cards WHERE user_id = ? AND updated_at > ?')
      .bind(userId, since),
    db
      .prepare('SELECT * FROM reviews WHERE user_id = ? AND reviewed_at > ?')
      .bind(userId, since),
  ]);

  return {
    decks: (deckRes.results as any[]).map(rowToDeck),
    cards: (cardRes.results as any[]).map(rowToCard),
    reviews: (reviewRes.results as any[]).map(rowToReview),
  };
}

// ---------------------------------------------------------------------------
// Apply: upsert a client SyncPayload with last-write-wins by updated_at.
// user_id is forced to the authenticated user on every row so a client can
// never write another user's data. Reviews are append-only (INSERT OR IGNORE).
// ---------------------------------------------------------------------------

const DECK_UPSERT = `
INSERT INTO decks (id, user_id, title, description, created_at, updated_at, deleted)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  user_id     = excluded.user_id,
  title       = excluded.title,
  description = excluded.description,
  created_at  = excluded.created_at,
  updated_at  = excluded.updated_at,
  deleted     = excluded.deleted
WHERE excluded.updated_at > decks.updated_at`;

const CARD_UPSERT = `
INSERT INTO cards (
  id, deck_id, user_id, front, back,
  due, stability, difficulty, elapsed_days, scheduled_days,
  reps, lapses, state, last_review,
  created_at, updated_at, deleted
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  deck_id        = excluded.deck_id,
  user_id        = excluded.user_id,
  front          = excluded.front,
  back           = excluded.back,
  due            = excluded.due,
  stability      = excluded.stability,
  difficulty     = excluded.difficulty,
  elapsed_days   = excluded.elapsed_days,
  scheduled_days = excluded.scheduled_days,
  reps           = excluded.reps,
  lapses         = excluded.lapses,
  state          = excluded.state,
  last_review    = excluded.last_review,
  created_at     = excluded.created_at,
  updated_at     = excluded.updated_at,
  deleted        = excluded.deleted
WHERE excluded.updated_at > cards.updated_at`;

const REVIEW_INSERT = `
INSERT OR IGNORE INTO reviews (
  id, card_id, user_id, rating, state, due, stability, difficulty,
  elapsed_days, last_elapsed_days, scheduled_days, reviewed_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

export async function applyChanges(
  db: D1Database,
  userId: string,
  changes: SyncPayload,
): Promise<void> {
  const statements: D1PreparedStatement[] = [];

  for (const d of changes.decks ?? []) {
    statements.push(
      db
        .prepare(DECK_UPSERT)
        .bind(
          d.id,
          userId, // force ownership
          d.title,
          d.description ?? null,
          d.createdAt,
          d.updatedAt,
          d.deleted ? 1 : 0,
        ),
    );
  }

  for (const card of changes.cards ?? []) {
    statements.push(
      db
        .prepare(CARD_UPSERT)
        .bind(
          card.id,
          card.deckId,
          userId, // force ownership
          card.front,
          card.back,
          card.due,
          card.stability,
          card.difficulty,
          card.elapsed_days,
          card.scheduled_days,
          card.reps,
          card.lapses,
          card.state,
          card.last_review ?? null,
          card.createdAt,
          card.updatedAt,
          card.deleted ? 1 : 0,
        ),
    );
  }

  for (const r of changes.reviews ?? []) {
    statements.push(
      db
        .prepare(REVIEW_INSERT)
        .bind(
          r.id,
          r.cardId,
          userId, // force ownership
          r.rating,
          r.state,
          r.due,
          r.stability,
          r.difficulty,
          r.elapsed_days,
          r.last_elapsed_days,
          r.scheduled_days,
          r.reviewedAt,
        ),
    );
  }

  if (statements.length > 0) {
    // Single batched, atomic round-trip for efficiency.
    await db.batch(statements);
  }
}
