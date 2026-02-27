/**
 * LBS FieldGuard — Utility: ID generation
 *
 * Generates random short IDs without external dependencies.
 */

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function nanoid(len = 21): string {
  let id = '';
  const arr = new Uint8Array(len);
  // Hermes supports crypto.getRandomValues
  try {
    (globalThis as unknown as { crypto: { getRandomValues: (a: Uint8Array) => void } }).crypto.getRandomValues(arr);
  } catch (_) {
    for (let i = 0; i < len; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  for (const b of arr) id += CHARS[b % CHARS.length];
  return id;
}
