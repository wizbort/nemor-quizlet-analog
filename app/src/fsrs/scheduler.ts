import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  type Card as FsrsCard,
  type Grade,
  type RecordLogItem,
} from 'ts-fsrs';
import type { Card, ReviewLog } from '../types';
import { uuid } from '../config';

// Client-side spaced repetition via ts-fsrs. Scheduling is computed locally;
// the Worker only persists the resulting FSRS fields and review logs.
//
// Rating is re-exported from ts-fsrs so callers use a single source of truth:
//   Rating.Again=1, Rating.Hard=2, Rating.Good=3, Rating.Easy=4.
export { Rating } from 'ts-fsrs';

// The subset of Card that holds FSRS scheduling state.
export type FsrsFields = Pick<
  Card,
  | 'due'
  | 'stability'
  | 'difficulty'
  | 'elapsed_days'
  | 'scheduled_days'
  | 'reps'
  | 'lapses'
  | 'state'
  | 'last_review'
>;

// Single scheduler instance with fuzz enabled (spreads due dates to avoid
// review pileups). ts-fsrs is stateless per-call, so one instance is reused.
const f = fsrs(generatorParameters({ enable_fuzz: true }));

/** Russian labels for the four ratings, keyed by the ts-fsrs Rating value. */
const RATING_LABELS_RU: Record<number, string> = {
  [Rating.Again]: 'Снова',
  [Rating.Hard]: 'Трудно',
  [Rating.Good]: 'Хорошо',
  [Rating.Easy]: 'Легко',
};

/** Human-readable Russian label for a rating (Снова/Трудно/Хорошо/Легко). */
export function ratingLabel(rating: Rating): string {
  return RATING_LABELS_RU[rating] ?? '';
}

/** Flatten a ts-fsrs Card (Date-based) to our stored epoch-ms FsrsFields. */
function flatten(card: FsrsCard): FsrsFields {
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.getTime() : null,
  };
}

/** Rebuild a ts-fsrs Card (Date-based) from stored epoch-ms FsrsFields. */
function inflate(fields: FsrsFields): FsrsCard {
  return {
    due: new Date(fields.due),
    stability: fields.stability,
    difficulty: fields.difficulty,
    elapsed_days: fields.elapsed_days,
    scheduled_days: fields.scheduled_days,
    reps: fields.reps,
    lapses: fields.lapses,
    state: fields.state,
    last_review:
      fields.last_review != null ? new Date(fields.last_review) : undefined,
  } as FsrsCard;
}

/** Initial FSRS fields for a brand-new card created at `nowMs`. */
export function newCardFsrs(nowMs: number): FsrsFields {
  return flatten(createEmptyCard(new Date(nowMs)));
}

/**
 * Apply a review at `nowMs` with the given rating, returning the card's updated
 * FSRS fields plus a ReviewLog entry to persist.
 */
export function review(
  card: Card,
  rating: Rating,
  nowMs: number,
): { card: FsrsFields; log: ReviewLog } {
  // The four user-facing ratings (Again/Hard/Good/Easy) are all valid Grades;
  // Rating.Manual is never produced by the review UI, so the cast is safe.
  const item: RecordLogItem = f.next(
    inflate(card),
    new Date(nowMs),
    rating as Grade,
  );
  const log: ReviewLog = {
    id: uuid(),
    cardId: card.id,
    userId: card.userId,
    rating: item.log.rating,
    state: item.log.state,
    due: item.log.due.getTime(),
    stability: item.log.stability,
    difficulty: item.log.difficulty,
    elapsed_days: item.log.elapsed_days,
    last_elapsed_days: item.log.last_elapsed_days,
    scheduled_days: item.log.scheduled_days,
    reviewedAt: nowMs,
  };
  return { card: flatten(item.card), log };
}
