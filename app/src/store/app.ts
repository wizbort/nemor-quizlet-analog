import { create } from 'zustand';
import type { Deck, Card } from '../types';
import { createRepository, type Repository } from '../data/repository';
import { newCardFsrs, review as fsrsReview, type FsrsFields } from '../fsrs/scheduler';
import type { Rating } from '../fsrs/scheduler';
import { runSync } from '../sync/engine';
import { useAuthStore } from './auth';
import { uuid, now } from '../config';

// App store: decks list + sync status, backed by the platform repository.
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'synced';

// Shared singleton repository (lazily initialized on first use).
let repoSingleton: Repository | null = null;
let repoReady: Promise<Repository> | null = null;
async function getRepo(): Promise<Repository> {
  if (repoSingleton) return repoSingleton;
  if (!repoReady) {
    const repo = createRepository();
    repoReady = repo.init().then(() => {
      repoSingleton = repo;
      return repo;
    });
  }
  return repoReady;
}

export interface AppState {
  decks: Deck[];
  syncStatus: SyncStatus;
  lastSyncedAt: number | null;
  /** Load decks from the local repository into the store. */
  loadDecks(): Promise<void>;
  /** Create a new deck owned by the current user; returns the new deck. */
  createDeck(title: string, desc?: string): Promise<Deck>;
  /** Rename / re-describe an existing deck. */
  renameDeck(id: string, title: string, desc?: string): Promise<void>;
  /** Soft-delete a deck (and cascade its cards). */
  deleteDeck(id: string): Promise<void>;
  /** Append new cards (front/back pairs) to a deck; returns the created cards. */
  addCards(deckId: string, pairs: Array<{ front: string; back: string }>): Promise<Card[]>;
  /** Update an existing card's content (front/back). */
  updateCard(id: string, patch: { front?: string; back?: string }): Promise<void>;
  /** Soft-delete a single card. */
  deleteCard(id: string): Promise<void>;
  /** Apply a review rating to a card: schedule via FSRS, persist card + log. */
  reviewCard(cardId: string, rating: Rating): Promise<void>;
  /** Run a full pull/push sync cycle, updating syncStatus. */
  sync(): Promise<void>;
}

function userId(): string {
  return useAuthStore.getState().user?.id ?? 'local';
}

export const useAppStore = create<AppState>((set, get) => ({
  decks: [],
  syncStatus: 'idle',
  lastSyncedAt: null,

  async loadDecks() {
    const repo = await getRepo();
    const decks = await repo.getDecks();
    set({ decks });
  },

  async createDeck(title: string, desc?: string) {
    const repo = await getRepo();
    const ts = now();
    const deck: Deck = {
      id: uuid(),
      userId: userId(),
      title,
      description: desc ?? null,
      createdAt: ts,
      updatedAt: ts,
      deleted: 0,
    };
    await repo.upsertDeck(deck);
    set({ decks: [deck, ...get().decks] });
    return deck;
  },

  async renameDeck(id: string, title: string, desc?: string) {
    const repo = await getRepo();
    const existing = await repo.getDeck(id);
    if (!existing) return;
    const updated: Deck = {
      ...existing,
      title,
      description: desc === undefined ? existing.description : desc,
      updatedAt: now(),
    };
    await repo.upsertDeck(updated);
    set({ decks: get().decks.map((d) => (d.id === id ? updated : d)) });
  },

  async deleteDeck(id: string) {
    const repo = await getRepo();
    await repo.softDeleteDeck(id);
    set({ decks: get().decks.filter((d) => d.id !== id) });
  },

  async addCards(deckId: string, pairs: Array<{ front: string; back: string }>) {
    const repo = await getRepo();
    const uid = userId();
    const cards: Card[] = pairs.map(({ front, back }) => {
      const ts = now();
      const f: FsrsFields = newCardFsrs(ts);
      return {
        id: uuid(),
        deckId,
        userId: uid,
        front,
        back,
        ...f,
        createdAt: ts,
        updatedAt: ts,
        deleted: 0,
      };
    });
    await repo.upsertCards(cards);
    return cards;
  },

  async updateCard(id: string, patch: { front?: string; back?: string }) {
    const repo = await getRepo();
    const existing = await repo.getCard(id);
    if (!existing) return;
    const updated: Card = {
      ...existing,
      front: patch.front ?? existing.front,
      back: patch.back ?? existing.back,
      updatedAt: now(),
    };
    await repo.upsertCard(updated);
  },

  async deleteCard(id: string) {
    const repo = await getRepo();
    await repo.softDeleteCard(id);
  },

  async reviewCard(cardId: string, rating: Rating) {
    const repo = await getRepo();
    const card = await repo.getCard(cardId);
    if (!card) return;
    const ts = now();
    const { card: fields, log } = fsrsReview(card, rating, ts);
    const updated: Card = { ...card, ...fields, updatedAt: ts };
    await repo.upsertCard(updated);
    await repo.addReview(log);
  },

  async sync() {
    const token = useAuthStore.getState().session;
    if (!token) {
      set({ syncStatus: 'idle' });
      return;
    }
    set({ syncStatus: 'syncing' });
    const repo = await getRepo();
    const result = await runSync(repo, token);
    if (result.status === 'synced') {
      // Refresh decks from the merged local state.
      const decks = await repo.getDecks();
      set({ decks, syncStatus: 'synced', lastSyncedAt: result.now });
    } else if (result.status === 'offline') {
      set({ syncStatus: 'error' });
    } else {
      set({ syncStatus: 'idle' });
    }
  },
}));
