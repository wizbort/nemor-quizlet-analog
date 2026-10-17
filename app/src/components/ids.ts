// Small client-side id + time helpers used by the UI when creating rows.

/** RFC4122-ish unique id. Uses crypto.randomUUID when available. */
export function uid(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function nowMs(): number {
  return Date.now();
}

/** Human-friendly relative time in Russian, e.g. "2 мин назад". */
export function formatRelative(ts: number | null): string {
  if (!ts) return 'никогда';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'только что';
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  const day = Math.floor(hr / 24);
  return `${day} дн назад`;
}
