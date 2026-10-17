// Shared domain types. Kept in sync with worker/src/types.ts (minus Env).
// See /CONTRACT.md for the governing contract.

export interface Deck {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  createdAt: number;
  updatedAt: number;
  deleted: 0 | 1;
}

export interface Card {
  id: string;
  deckId: string;
  userId: string;
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
  createdAt: number;
  updatedAt: number;
  deleted: 0 | 1;
}

export interface ReviewLog {
  id: string;
  cardId: string;
  userId: string;
  rating: number;
  state: number;
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  last_elapsed_days: number;
  scheduled_days: number;
  reviewedAt: number;
}

export interface QuizQuestion {
  id: string;
  type: 'mcq' | 'short';
  prompt: string;
  options?: string[];
  answerIndex?: number;
  answer?: string;
  explanation?: string;
}

export interface AuthUser {
  id: string;
  phone?: string | null;
  email?: string | null;
}

export interface SyncPayload {
  decks: Deck[];
  cards: Card[];
  reviews: ReviewLog[];
}

export interface SyncPullResult extends SyncPayload {
  now: number;
}
