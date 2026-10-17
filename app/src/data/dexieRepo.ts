import Dexie, { type Table } from 'dexie';
import type { Deck, Card, ReviewLog, SyncPayload } from '../types';
import type { Repository } from './repository';
import { now } from '../config';

// Web cache backed by Dexie (IndexedDB). Mirrors the D1 schema; soft-deletes
// only, last-write-wins merge by updatedAt so sync converges.
class NemorDb extends Dexie {
  decks!: Table<Deck, string>;
  cards!: Table<Card, string>;
  reviews!: Table<ReviewLog, string>;
  meta!: Table<{ key: string; value: string }, string>;

  constructor() {
    super('nemor-cards');
    this.version(1).stores({
      // Primary key first; secondary indexes for sync + due queries.
      decks: 'id, updatedAt',
      cards: 'id, updatedAt, deckId, [deckId+due], due',
      reviews: 'id, reviewedAt',
      meta: 'key',
    });
  }
}

export class DexieRepository implements Repository {
  private db = new NemorDb();

  async init(): Promise<void> {
    if (!this.db.isOpen()) await this.db.open();
  }

  // --- Decks ---
  async getDecks(): Promise<Deck[]> {
    const rows = await this.db.decks.where('updatedAt').above(-1).toArray();
    return rows
      .filter((d) => d.deleted === 0)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getDeck(id: string): Promise<Deck | undefined> {
    return this.db.decks.get(id);
  }

  async upsertDeck(d: Deck): Promise<void> {
    await this.db.decks.put(d);
  }

  async softDeleteDeck(id: string): Promise<void> {
    const ts = now();
    await this.db.transaction('rw', this.db.decks, this.db.cards, async () => {
      const deck = await this.db.decks.get(id);
      if (deck) await this.db.decks.put({ ...deck, deleted: 1, updatedAt: ts });
      // Cascade soft-delete the deck's cards so they propagate too.
      const cards = await this.db.cards.where('deckId').equals(id).toArray();
      for (const c of cards) {
        if (c.deleted === 0) {
          await this.db.cards.put({ ...c, deleted: 1, updatedAt: ts });
        }
      }
    });
  }

  // --- Cards ---
  async getCards(deckId: string): Promise<Card[]> {
    const rows = await this.db.cards.where('deckId').equals(deckId).toArray();
    return rows
      .filter((c) => c.deleted === 0)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  async getCard(id: string): Promise<Card | undefined> {
    return this.db.cards.get(id);
  }

  async getDueCards(
    deckId: string | null,
    nowMs: number,
    limit?: number,
  ): Promise<Card[]> {
    let rows: Card[];
    if (deckId) {
      rows = await this.db.cards.where('deckId').equals(deckId).toArray();
    } else {
      rows = await this.db.cards.toArray();
    }
    const due = rows
      .filter((c) => c.deleted === 0 && c.due <= nowMs)
      .sort((a, b) => a.due - b.due);
    return typeof limit === 'number' ? due.slice(0, limit) : due;
  }

  async countDue(deckId: string, nowMs: number): Promise<number> {
    const rows = await this.db.cards.where('deckId').equals(deckId).toArray();
    return rows.filter((c) => c.deleted === 0 && c.due <= nowMs).length;
  }

  async upsertCard(c: Card): Promise<void> {
    await this.db.cards.put(c);
  }

  async upsertCards(cs: Card[]): Promise<void> {
    if (cs.length) await this.db.cards.bulkPut(cs);
  }

  async softDeleteCard(id: string): Promise<void> {
    const c = await this.db.cards.get(id);
    if (c) await this.db.cards.put({ ...c, deleted: 1, updatedAt: now() });
  }

  // --- Reviews ---
  async addReview(r: ReviewLog): Promise<void> {
    await this.db.reviews.put(r);
  }

  // --- Sync ---
  async getChangedSince(sinceMs: number): Promise<SyncPayload> {
    const [decks, cards, reviews] = await Promise.all([
      this.db.decks.where('updatedAt').above(sinceMs).toArray(),
      this.db.cards.where('updatedAt').above(sinceMs).toArray(),
      this.db.reviews.where('reviewedAt').above(sinceMs).toArray(),
    ]);
    return { decks, cards, reviews };
  }

  async applyRemote(changes: SyncPayload): Promise<void> {
    await this.db.transaction(
      'rw',
      this.db.decks,
      this.db.cards,
      this.db.reviews,
      async () => {
        for (const d of changes.decks) {
          const local = await this.db.decks.get(d.id);
          if (!local || d.updatedAt >= local.updatedAt) {
            await this.db.decks.put(d);
          }
        }
        for (const c of changes.cards) {
          const local = await this.db.cards.get(c.id);
          if (!local || c.updatedAt >= local.updatedAt) {
            await this.db.cards.put(c);
          }
        }
        for (const r of changes.reviews) {
          // Reviews are immutable append-only: insert only if id is absent.
          const local = await this.db.reviews.get(r.id);
          if (!local) await this.db.reviews.put(r);
        }
      },
    );
  }

  // --- Meta ---
  async getMeta(key: string): Promise<string | undefined> {
    const row = await this.db.meta.get(key);
    return row?.value;
  }

  async setMeta(key: string, value: string): Promise<void> {
    await this.db.meta.put({ key, value });
  }
}
