-- Nemor Cards — D1 schema (source of truth).
-- All timestamps are epoch milliseconds (INTEGER). Soft delete via `deleted` (0/1).

CREATE TABLE IF NOT EXISTS decks (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cards (
  id             TEXT PRIMARY KEY,
  deck_id        TEXT NOT NULL,
  user_id        TEXT NOT NULL,
  front          TEXT NOT NULL,
  back           TEXT NOT NULL,
  -- ts-fsrs scheduling fields
  due            INTEGER NOT NULL DEFAULT 0,
  stability      REAL NOT NULL DEFAULT 0,
  difficulty     REAL NOT NULL DEFAULT 0,
  elapsed_days   REAL NOT NULL DEFAULT 0,
  scheduled_days REAL NOT NULL DEFAULT 0,
  reps           INTEGER NOT NULL DEFAULT 0,
  lapses         INTEGER NOT NULL DEFAULT 0,
  state          INTEGER NOT NULL DEFAULT 0,
  last_review    INTEGER,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  deleted        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reviews (
  id                TEXT PRIMARY KEY,
  card_id           TEXT NOT NULL,
  user_id           TEXT NOT NULL,
  rating            INTEGER NOT NULL,
  state             INTEGER NOT NULL,
  due               INTEGER NOT NULL,
  stability         REAL NOT NULL,
  difficulty        REAL NOT NULL,
  elapsed_days      REAL NOT NULL,
  last_elapsed_days REAL NOT NULL,
  scheduled_days    REAL NOT NULL,
  reviewed_at       INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_decks_user_updated   ON decks (user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_cards_user_updated   ON cards (user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_cards_deck           ON cards (deck_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_reviewed ON reviews (user_id, reviewed_at);
