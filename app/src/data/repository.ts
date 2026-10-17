import { Platform } from 'react-native';
import type { Deck, Card, ReviewLog, SyncPayload } from '../types';
import { DexieRepository } from './dexieRepo';
import { SqliteRepository } from './sqliteRepo';

// Local cache abstraction. Web uses Dexie (IndexedDB); native uses expo-sqlite.
export interface Repository {
  init(): Promise<void>;
  getDecks(): Promise<Deck[]>;
  getDeck(id: string): Promise<Deck | undefined>;
  upsertDeck(d: Deck): Promise<void>;
  softDeleteDeck(id: string): Promise<void>;
  getCards(deckId: string): Promise<Card[]>;
  getCard(id: string): Promise<Card | undefined>;
  getDueCards(deckId: string | null, nowMs: number, limit?: number): Promise<Card[]>;
  countDue(deckId: string, nowMs: number): Promise<number>;
  upsertCard(c: Card): Promise<void>;
  upsertCards(cs: Card[]): Promise<void>;
  softDeleteCard(id: string): Promise<void>;
  addReview(r: ReviewLog): Promise<void>;
  getChangedSince(sinceMs: number): Promise<SyncPayload>;
  applyRemote(changes: SyncPayload): Promise<void>;
  getMeta(key: string): Promise<string | undefined>;
  setMeta(key: string, value: string): Promise<void>;
}

/** Pick the platform-appropriate Repository implementation. */
export function createRepository(): Repository {
  if (Platform.OS === 'web') {
    return new DexieRepository();
  }
  return new SqliteRepository();
}
