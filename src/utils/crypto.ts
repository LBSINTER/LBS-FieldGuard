/**
 * LBS FieldGuard — Utility: crypto helpers (JS-side, no native)
 *
 * Provides a simple SHA-256 digest using the Web Crypto API (exposed by
 * Hermes/JavaScriptCore via react-native-quick-crypto polyfill fallback).
 * If unavailable, returns an empty string gracefully.
 */

export async function createHash(algorithm: 'sha256', data: Buffer): Promise<string> {
  try {
    // Try Web Crypto (available on RN >= 0.71 with Hermes)
    const subtle = (globalThis as unknown as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
    if (subtle) {
      const hashBuf = await subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch (_) {}
  return '';
}
