import type { Repository } from '../data/repository';
import { pullSync, pushSync } from '../api/client';

// Sync engine: push local changes since the last cursor, pull remote changes,
// apply them locally, and advance the cursor. Offline / unauthenticated calls
// no-op gracefully and report status rather than throwing.

const LAST_SYNC_KEY = 'lastSync';

export type SyncResult =
  | { status: 'synced'; now: number }
  | { status: 'skipped'; reason: 'no-token' }
  | { status: 'offline' };

/**
 * Run a full push/pull sync cycle. Reads meta 'lastSync' (epoch ms, default 0),
 * pushes locally-changed rows, pulls remote changes since the cursor, applies
 * them via last-write-wins, and stores the server's `now` as the new cursor.
 */
export async function runSync(
  repo: Repository,
  sessionToken: string,
): Promise<SyncResult> {
  if (!sessionToken) return { status: 'skipped', reason: 'no-token' };

  const raw = await repo.getMeta(LAST_SYNC_KEY);
  const lastSync = raw ? Number(raw) || 0 : 0;

  try {
    // Push local changes first so the server has them before we pull.
    const local = await repo.getChangedSince(lastSync);
    if (local.decks.length || local.cards.length || local.reviews.length) {
      await pushSync(local, sessionToken);
    }

    // Pull remote changes accumulated since the cursor and merge locally.
    const remote = await pullSync(lastSync, sessionToken);
    await repo.applyRemote({
      decks: remote.decks,
      cards: remote.cards,
      reviews: remote.reviews,
    });

    await repo.setMeta(LAST_SYNC_KEY, String(remote.now));
    return { status: 'synced', now: remote.now };
  } catch {
    // Network failure or transient server error — treat as offline; the next
    // sync resumes from the same cursor, so nothing is lost.
    return { status: 'offline' };
  }
}
