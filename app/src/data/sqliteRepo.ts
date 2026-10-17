import * as SQLite from 'expo-sqlite';
import type { Deck, Card, ReviewLog, SyncPayload } from '../types';
import type { Repository } from './repository';
import { now } from '../config';

// Native cache backed by expo-sqlite. Columns mirror worker/schema.sql exactly
// (snake_case in SQL); domain objects use camelCase. Same upsert/LWW semantics
// as the Dexie repository so both backends converge identically on sync.

type DeckRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  created_at: number;
  updated_at: number;
  deleted: number;
};

type CardRow = {
  id: string;
  deck_id: string;
  user_id: string;
  front: string;
  back: string;
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: number | null;
  created_at: number;
  updated_at: number;
  deleted: number;
};

type ReviewRow = {
  id: string;
  card_id: string;
  user_id: string;
  rating: number;
  state: number;
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  last_elapsed_days: number;
  scheduled_days: number;
  reviewed_at: number;
};

function toDeck(r: DeckRow): Deck {
  return {
    id: r.id,
    userId: r.user_id,
    title: r.title,
    description: r.description,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deleted: (r.deleted ? 1 : 0) as 0 | 1,
  };
}

function toCard(r: CardRow): Card {
  return {
    id: r.id,
    deckId: r.deck_id,
    userId: r.user_id,
    front: r.front,
    back: r.back,
    due: r.due,
    stability: r.stability,
    difficulty: r.difficulty,
    elapsed_days: r.elapsed_days,
    scheduled_days: r.scheduled_days,
    reps: r.reps,
    lapses: r.lapses,
    state: r.state,
    last_review: r.last_review,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deleted: (r.deleted ? 1 : 0) as 0 | 1,
  };
}

function toReview(r: ReviewRow): ReviewLog {
  return {
    id: r.id,
    cardId: r.card_id,
    userId: r.user_id,
    rating: r.rating,
    state: r.state,
    due: r.due,
    stability: r.stability,
    difficulty: r.difficulty,
    elapsed_days: r.elapsed_days,
    last_elapsed_days: r.last_elapsed_days,
    scheduled_days: r.scheduled_days,
    reviewedAt: r.reviewed_at,
  };
}

const DECK_UPSERT = `INSERT INTO decks (id, user_id, title, description, created_at, updated_at, deleted)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  user_id=excluded.user_id, title=excluded.title, description=excluded.description,
  created_at=excluded.created_at, updated_at=excluded.updated_at, deleted=excluded.deleted`;

const CARD_UPSERT = `INSERT INTO cards (id, deck_id, user_id, front, back, due, stability, difficulty,
  elapsed_days, scheduled_days, reps, lapses, state, last_review, created_at, updated_at, deleted)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  deck_id=excluded.deck_id, user_id=excluded.user_id, front=excluded.front, back=excluded.back,
  due=excluded.due, stability=excluded.stability, difficulty=excluded.difficulty,
  elapsed_days=excluded.elapsed_days, scheduled_days=excluded.scheduled_days, reps=excluded.reps,
  lapses=excluded.lapses, state=excluded.state, last_review=excluded.last_review,
  created_at=excluded.created_at, updated_at=excluded.updated_at, deleted=excluded.deleted`;

function deckArgs(d: Deck) {
  return [d.id, d.userId, d.title, d.description ?? null, d.createdAt, d.updatedAt, d.deleted];
}

function cardArgs(c: Card) {
  return [
    c.id, c.deckId, c.userId, c.front, c.back, c.due, c.stability, c.difficulty,
    c.elapsed_days, c.scheduled_days, c.reps, c.lapses, c.state, c.last_review,
    c.createdAt, c.updatedAt, c.deleted,
  ];
}

export class SqliteRepository implements Repository {
  private dbp: Promise<SQLite.SQLiteDatabase> | null = null;

  private db(): Promise<SQLite.SQLiteDatabase> {
    if (!this.dbp) this.dbp = SQLite.openDatabaseAsync('nemor-cards.db');
    return this.dbp;
  }

  async init(): Promise<void> {
    const db = await this.db();
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS decks (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL,
        description TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY, deck_id TEXT NOT NULL, user_id TEXT NOT NULL,
        front TEXT NOT NULL, back TEXT NOT NULL,
        due INTEGER NOT NULL DEFAULT 0, stability REAL NOT NULL DEFAULT 0,
        difficulty REAL NOT NULL DEFAULT 0, elapsed_days REAL NOT NULL DEFAULT 0,
        scheduled_days REAL NOT NULL DEFAULT 0, reps INTEGER NOT NULL DEFAULT 0,
        lapses INTEGER NOT NULL DEFAULT 0, state INTEGER NOT NULL DEFAULT 0,
        last_review INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY, card_id TEXT NOT NULL, user_id TEXT NOT NULL,
        rating INTEGER NOT NULL, state INTEGER NOT NULL, due INTEGER NOT NULL,
        stability REAL NOT NULL, difficulty REAL NOT NULL, elapsed_days REAL NOT NULL,
        last_elapsed_days REAL NOT NULL, scheduled_days REAL NOT NULL,
        reviewed_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_decks_updated ON decks (updated_at);
      CREATE INDEX IF NOT EXISTS idx_cards_updated ON cards (updated_at);
      CREATE INDEX IF NOT EXISTS idx_cards_deck ON cards (deck_id);
      CREATE INDEX IF NOT EXISTS idx_cards_due ON cards (due);
      CREATE INDEX IF NOT EXISTS idx_reviews_reviewed ON reviews (reviewed_at);
    `);
  }

  // --- Decks ---
  async getDecks(): Promise<Deck[]> {
    const db = await this.db();
    const rows = await db.getAllAsync<DeckRow>(
      'SELECT * FROM decks WHERE deleted = 0 ORDER BY updated_at DESC',
    );
    return rows.map(toDeck);
  }

  async getDeck(id: string): Promise<Deck | undefined> {
    const db = await this.db();
    const row = await db.getFirstAsync<DeckRow>('SELECT * FROM decks WHERE id = ?', [id]);
    return row ? toDeck(row) : undefined;
  }

  async upsertDeck(d: Deck): Promise<void> {
    const db = await this.db();
    await db.runAsync(DECK_UPSERT, deckArgs(d));
  }

  async softDeleteDeck(id: string): Promise<void> {
    const db = await this.db();
    const ts = now();
    await db.withTransactionAsync(async () => {
      await db.runAsync('UPDATE decks SET deleted = 1, updated_at = ? WHERE id = ?', [ts, id]);
      await db.runAsync(
        'UPDATE cards SET deleted = 1, updated_at = ? WHERE deck_id = ? AND deleted = 0',
        [ts, id],
      );
    });
  }

  // --- Cards ---
  async getCards(deckId: string): Promise<Card[]> {
    const db = await this.db();
    const rows = await db.getAllAsync<CardRow>(
      'SELECT * FROM cards WHERE deck_id = ? AND deleted = 0 ORDER BY created_at ASC',
      [deckId],
    );
    return rows.map(toCard);
  }

  async getCard(id: string): Promise<Card | undefined> {
    const db = await this.db();
    const row = await db.getFirstAsync<CardRow>('SELECT * FROM cards WHERE id = ?', [id]);
    return row ? toCard(row) : undefined;
  }

  async getDueCards(
    deckId: string | null,
    nowMs: number,
    limit?: number,
  ): Promise<Card[]> {
    const db = await this.db();
    const lim = typeof limit === 'number' ? ' LIMIT ?' : '';
    let rows: CardRow[];
    if (deckId) {
      const args: (string | number)[] = [deckId, nowMs];
      if (typeof limit === 'number') args.push(limit);
      rows = await db.getAllAsync<CardRow>(
        `SELECT * FROM cards WHERE deck_id = ? AND deleted = 0 AND due <= ? ORDER BY due ASC${lim}`,
        args,
      );
    } else {
      const args: (string | number)[] = [nowMs];
      if (typeof limit === 'number') args.push(limit);
      rows = await db.getAllAsync<CardRow>(
        `SELECT * FROM cards WHERE deleted = 0 AND due <= ? ORDER BY due ASC${lim}`,
        args,
      );
    }
    return rows.map(toCard);
  }

  async countDue(deckId: string, nowMs: number): Promise<number> {
    const db = await this.db();
    const row = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM cards WHERE deck_id = ? AND deleted = 0 AND due <= ?',
      [deckId, nowMs],
    );
    return row?.n ?? 0;
  }

  async upsertCard(c: Card): Promise<void> {
    const db = await this.db();
    await db.runAsync(CARD_UPSERT, cardArgs(c));
  }

  async upsertCards(cs: Card[]): Promise<void> {
    if (!cs.length) return;
    const db = await this.db();
    await db.withTransactionAsync(async () => {
      for (const c of cs) await db.runAsync(CARD_UPSERT, cardArgs(c));
    });
  }

  async softDeleteCard(id: string): Promise<void> {
    const db = await this.db();
    await db.runAsync('UPDATE cards SET deleted = 1, updated_at = ? WHERE id = ?', [now(), id]);
  }

  // --- Reviews ---
  async addReview(r: ReviewLog): Promise<void> {
    const db = await this.db();
    await db.runAsync(
      `INSERT OR IGNORE INTO reviews (id, card_id, user_id, rating, state, due, stability,
        difficulty, elapsed_days, last_elapsed_days, scheduled_days, reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.id, r.cardId, r.userId, r.rating, r.state, r.due, r.stability, r.difficulty,
        r.elapsed_days, r.last_elapsed_days, r.scheduled_days, r.reviewedAt,
      ],
    );
  }

  // --- Sync ---
  async getChangedSince(sinceMs: number): Promise<SyncPayload> {
    const db = await this.db();
    const [decks, cards, reviews] = await Promise.all([
      db.getAllAsync<DeckRow>('SELECT * FROM decks WHERE updated_at > ?', [sinceMs]),
      db.getAllAsync<CardRow>('SELECT * FROM cards WHERE updated_at > ?', [sinceMs]),
      db.getAllAsync<ReviewRow>('SELECT * FROM reviews WHERE reviewed_at > ?', [sinceMs]),
    ]);
    return { decks: decks.map(toDeck), cards: cards.map(toCard), reviews: reviews.map(toReview) };
  }

  async applyRemote(changes: SyncPayload): Promise<void> {
    const db = await this.db();
    await db.withTransactionAsync(async () => {
      for (const d of changes.decks) {
        const local = await db.getFirstAsync<{ updated_at: number }>(
          'SELECT updated_at FROM decks WHERE id = ?',
          [d.id],
        );
        if (!local || d.updatedAt >= local.updated_at) await db.runAsync(DECK_UPSERT, deckArgs(d));
      }
      for (const c of changes.cards) {
        const local = await db.getFirstAsync<{ updated_at: number }>(
          'SELECT updated_at FROM cards WHERE id = ?',
          [c.id],
        );
        if (!local || c.updatedAt >= local.updated_at) await db.runAsync(CARD_UPSERT, cardArgs(c));
      }
      for (const r of changes.reviews) {
        // Reviews are immutable append-only: insert only if id is absent.
        await db.runAsync(
          `INSERT OR IGNORE INTO reviews (id, card_id, user_id, rating, state, due, stability,
            difficulty, elapsed_days, last_elapsed_days, scheduled_days, reviewed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            r.id, r.cardId, r.userId, r.rating, r.state, r.due, r.stability, r.difficulty,
            r.elapsed_days, r.last_elapsed_days, r.scheduled_days, r.reviewedAt,
          ],
        );
      }
    });
  }

  // --- Meta ---
  async getMeta(key: string): Promise<string | undefined> {
    const db = await this.db();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM meta WHERE key = ?',
      [key],
    );
    return row?.value;
  }

  async setMeta(key: string, value: string): Promise<void> {
    const db = await this.db();
    await db.runAsync(
      'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value],
    );
  }
}
