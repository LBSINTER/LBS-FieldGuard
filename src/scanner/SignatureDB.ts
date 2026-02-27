/**
 * LBS FieldGuard — Byte-Pattern Signature Database
 *
 * Loads signatures from bundled JSON asset (assets/signatures/db.json) which
 * is compiled into the app bundle.  At runtime the scanner uses this DB to
 * match raw file bytes and SMS PDU payloads.
 *
 * Signature format (ByteSignature):
 *   id       — unique short identifier, e.g. "NSO_PEGASUS_STAGE1"
 *   name     — human-readable name
 *   category — pegasus | nso | ss7 | rat | stk | ota | malware
 *   severity — info | low | medium | high | critical
 *   pattern  — hex bytes separated by spaces, e.g. "d0 12 81 03"
 *   mask     — optional byte mask (FF=must match, 00=wildcard)
 *   description
 */

import { ByteSignature } from '../types';
// Bundled signature DB
import BUNDLED_DB from '../../assets/signatures/db.json';

let _db: ByteSignature[] = [];

/**
 * Load signatures into memory.  Returns count of loaded signatures.
 */
export async function loadSignatures(): Promise<number> {
  _db = BUNDLED_DB as ByteSignature[];
  return _db.length;
}

/**
 * Return all loaded signatures.
 */
export function getSignatures(): ByteSignature[] {
  return _db;
}

/**
 * Match a Buffer (or hex string) against the full signature DB.
 * Returns array of {sig, offset} matches.
 */
export function matchSignatures(
  data: Buffer | string,
  opts?: { maxMatches?: number }
): Array<{ sig: ByteSignature; offset: number }> {
  const buf = typeof data === 'string' ? Buffer.from(data.replace(/\s/g, ''), 'hex') : data;
  const max = opts?.maxMatches ?? 100;
  const results: Array<{ sig: ByteSignature; offset: number }> = [];

  for (const sig of _db) {
    if (results.length >= max) break;
    const patBytes = sig.pattern.split(' ').map((h) => parseInt(h, 16));
    const maskBytes = sig.mask
      ? sig.mask.split(' ').map((h) => parseInt(h, 16))
      : patBytes.map(() => 0xff);
    const offset = _indexOf(buf, patBytes, maskBytes);
    if (offset !== -1) {
      results.push({ sig, offset });
    }
  }
  return results;
}

function _indexOf(haystack: Buffer, pattern: number[], mask: number[]): number {
  const pLen = pattern.length;
  if (pLen === 0 || haystack.length < pLen) return -1;
  outer: for (let i = 0; i <= haystack.length - pLen; i++) {
    for (let j = 0; j < pLen; j++) {
      if ((haystack[i + j]! & mask[j]!) !== (pattern[j]! & mask[j]!)) continue outer;
    }
    return i;
  }
  return -1;
}
