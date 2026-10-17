// Runtime configuration for the client.

// API base URL. Empty string ('') means "same origin" — correct for the PWA
// build served by the Worker. For native or local dev, set EXPO_PUBLIC_API_BASE
// to the deployed Worker URL (e.g. https://nemor-cards.<account>.workers.dev).
export const API_BASE = (process.env.EXPO_PUBLIC_API_BASE ?? '').replace(/\/$/, '');

/** Current epoch milliseconds. Single source for "now" across the app. */
export function now(): number {
  return Date.now();
}

/**
 * Generate a stable RFC4122 v4 UUID. Prefers crypto.randomUUID (available on
 * web, modern Hermes, and Node 19+) and falls back to a crypto-backed (or, as a
 * last resort, Math.random-backed) implementation for older runtimes.
 */
export function uuid(): string {
  const c: Crypto | undefined =
    typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  // Per RFC4122 §4.4: set version (4) and variant (10xx).
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex: string[] = [];
  for (let i = 0; i < 256; i++) hex.push((i + 0x100).toString(16).slice(1));
  const b = bytes;
  return (
    hex[b[0]] + hex[b[1]] + hex[b[2]] + hex[b[3]] + '-' +
    hex[b[4]] + hex[b[5]] + '-' +
    hex[b[6]] + hex[b[7]] + '-' +
    hex[b[8]] + hex[b[9]] + '-' +
    hex[b[10]] + hex[b[11]] + hex[b[12]] + hex[b[13]] + hex[b[14]] + hex[b[15]]
  );
}
