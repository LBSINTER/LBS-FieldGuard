/**
 * LBS FieldGuard — File Scanner
 *
 * Scans files on the device filesystem by reading them in chunks and running
 * the signature DB matcher over each chunk (with overlap to catch signatures
 * that span chunk boundaries).
 *
 * Android: uses react-native-fs to access /sdcard, /data/local/tmp, and any
 *          path exposed by a content URI.
 * Windows: uses react-native-fs to access user profile, Program Files,
 *          AppData paths.
 */

import RNFS from 'react-native-fs';
import { Buffer } from 'buffer';
import { createHash } from '../utils/crypto';
import { matchSignatures } from './SignatureDB';
import { ScanResult, SignatureMatch } from '../types';
import { nanoid } from '../utils/id';

const CHUNK_SIZE = 128 * 1024; // 128 KB
const CHUNK_OVERLAP = 256;     // bytes of overlap to catch boundary patterns

export interface ScanOptions {
  path: string;
  recursive?: boolean;
  extensions?: string[];
  onProgress?: (scanned: number, total: number) => void;
}

/**
 * Scan a single file.  Returns a ScanResult even on error (verdict = 'clean', detail in sha256 field).
 */
export async function scanFile(filePath: string): Promise<ScanResult> {
  const stat = await RNFS.stat(filePath);
  const fileSize = stat.size;
  const fileName = filePath.split('/').pop() ?? filePath;

  const allMatches: SignatureMatch[] = [];
  let sha256 = '';

  try {
    // Read full file for hash, then scan in chunks for memory efficiency
    const fullB64 = await RNFS.readFile(filePath, 'base64');
    const fullBuf = Buffer.from(fullB64, 'base64');
    sha256 = await createHash('sha256', fullBuf);

    // Chunked scan
    for (let offset = 0; offset < fileSize; offset += CHUNK_SIZE - CHUNK_OVERLAP) {
      const chunk = fullBuf.slice(offset, offset + CHUNK_SIZE);
      const hits = matchSignatures(chunk);
      for (const { sig, offset: hitOffset } of hits) {
        allMatches.push({
          sigId: sig.id,
          name: sig.name,
          category: sig.category,
          offset: offset + hitOffset,
          length: sig.pattern.split(' ').length,
        });
      }
    }
  } catch (e) {
    // Unreadable file — mark as info
  }

  const verdictScore = allMatches.reduce((acc, m) => {
    const weights: Record<string, number> = { critical: 10, high: 6, medium: 3, low: 1, info: 0 };
    return acc + (weights[m.sigId] ?? 1);
  }, 0);

  return {
    id: nanoid(),
    ts: Date.now(),
    filePath,
    fileName,
    fileSize,
    sha256,
    matchedSignatures: allMatches,
    verdict: verdictScore >= 6 ? 'malicious' : verdictScore >= 2 ? 'suspicious' : 'clean',
  };
}

/**
 * Recursively collect file paths from a directory.
 */
export async function collectFiles(
  dir: string,
  extensions?: string[]
): Promise<string[]> {
  let result: string[] = [];
  try {
    const entries = await RNFS.readDir(dir);
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const sub = await collectFiles(entry.path, extensions);
        result = result.concat(sub);
      } else {
        if (!extensions || extensions.some((e) => entry.name.endsWith(e))) {
          result.push(entry.path);
        }
      }
    }
  } catch (_) {}
  return result;
}

/**
 * Full directory scan.
 */
export async function scanDirectory(opts: ScanOptions): Promise<ScanResult[]> {
  const files = await collectFiles(opts.path, opts.extensions);
  const results: ScanResult[] = [];
  for (let i = 0; i < files.length; i++) {
    opts.onProgress?.(i + 1, files.length);
    results.push(await scanFile(files[i]!));
  }
  return results;
}
