/**
 * LBS FieldGuard — Auto-Update Checker
 *
 * Primary:  our own relay server (/api.php/app/version) — fast, no rate limits, always reflects
 *           what's actually deployed to the local mirror APK.
 * Fallback: GitHub Releases API — used only when the primary is unreachable.
 *
 * Results are cached in AsyncStorage for 1 hour so the network is not hit on every
 * foreground event. The download URL always points to our own server's /dl/android
 * endpoint (which itself falls back to GitHub if no local mirror exists).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_VERSION, RELEASES_API_URL } from '../config/build';

// ── Constants ─────────────────────────────────────────────────────────────────

const CACHE_KEY     = '@fieldguard_update_check_v2';
const CACHE_TTL_MS  = 60 * 60 * 1000; // 1 hour

/** Primary — our own server; always up to date with the local APK mirror */
const OWN_VERSION_URL = 'https://fieldguard.lbs-int.com/api.php/app/version';

/** Direct APK download via our own origin mirror (fast, no GitHub rate limit) */
const OWN_DOWNLOAD_URL = 'https://fieldguard.lbs-int.com/dl/android';

/** Human-readable release page for confirmation before installing */
export const RELEASE_PAGE_URL = 'https://fieldguard.lbs-int.com/#download';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UpdateInfo {
  updateAvailable: boolean;
  currentVersion:  string;
  latestVersion?:  string;
  releaseNotes?:   string;
  /** Direct APK link — open this to download, then install */
  downloadUrl?:    string;
  /** Confirmation page — open this to read release notes before installing */
  releasePageUrl?: string;
  publishedAt?:    string;
  error?:          string;
  /** ISO timestamp of when this result was fetched */
  checkedAt?:      string;
}

interface CachedEntry {
  info:      UpdateInfo;
  fetchedAt: number; // Date.now()
}

interface OwnVersionResponse {
  version:      string;
  versionCode:  number;
  downloadUrl:  string;
  releaseNotes?: string;
  publishedAt:  string;
}

// ── Semver helpers ────────────────────────────────────────────────────────────

function parseSemver(tag: string): [number, number, number] {
  const clean = tag.replace(/^v/i, '').split('-')[0];
  const parts = clean.split('.').map(Number);
  const [major = 0, minor = 0, patch = 0] = parts;
  return [isNaN(major) ? 0 : major, isNaN(minor) ? 0 : minor, isNaN(patch) ? 0 : patch];
}

function isNewer(current: string, candidate: string): boolean {
  const [cMaj, cMin, cPat] = parseSemver(current);
  const [nMaj, nMin, nPat] = parseSemver(candidate);
  if (nMaj !== cMaj) return nMaj > cMaj;
  if (nMin !== cMin) return nMin > cMin;
  return nPat > cPat;
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

async function readCache(): Promise<CachedEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedEntry;
  } catch {
    return null;
  }
}

async function writeCache(info: UpdateInfo): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ info, fetchedAt: Date.now() } satisfies CachedEntry));
  } catch {}
}

// ── Primary check — our own server ────────────────────────────────────────────

async function checkOwnServer(): Promise<UpdateInfo | null> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 8_000);

    const res = await fetch(OWN_VERSION_URL, {
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': `LBSFieldGuard/${APP_VERSION}` },
      signal: controller.signal,
    });
    clearTimeout(tid);

    if (!res.ok) return null;

    const data: OwnVersionResponse = await res.json();
    if (!data.version) return null;

    const updateAvailable = isNewer(APP_VERSION, data.version);
    return {
      updateAvailable,
      currentVersion:  APP_VERSION,
      latestVersion:   data.version,
      releaseNotes:    data.releaseNotes,
      downloadUrl:     OWN_DOWNLOAD_URL,
      releasePageUrl:  RELEASE_PAGE_URL,
      publishedAt:     data.publishedAt,
      checkedAt:       new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// ── Fallback check — GitHub Releases API ──────────────────────────────────────

async function checkGitHub(): Promise<UpdateInfo> {
  const base: UpdateInfo = { updateAvailable: false, currentVersion: APP_VERSION };
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(RELEASES_API_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `LBSFieldGuard/${APP_VERSION}`,
      },
      signal: controller.signal,
    });
    clearTimeout(tid);

    if (!res.ok) return { ...base, error: `GitHub API ${res.status}` };

    const release = await res.json();
    const latestVersion: string = release.tag_name;
    if (!latestVersion) return { ...base, error: 'Missing tag_name' };
    if (release.prerelease) return { ...base, latestVersion };

    return {
      updateAvailable: isNewer(APP_VERSION, latestVersion),
      currentVersion:  APP_VERSION,
      latestVersion,
      releaseNotes:    release.body || undefined,
      downloadUrl:     OWN_DOWNLOAD_URL,
      releasePageUrl:  release.html_url,
      publishedAt:     release.published_at,
      checkedAt:       new Date().toISOString(),
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ...base, error: 'GitHub check timed out' };
    }
    return { ...base, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Full update check: tries own server first, falls back to GitHub.
 * Never throws. Serves from AsyncStorage cache if < 1 hour old.
 */
export async function checkForUpdate(forceRefresh = false): Promise<UpdateInfo> {
  if (!forceRefresh) {
    const cached = await readCache();
    if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
      return cached.info;
    }
  }

  const ownResult = await checkOwnServer();
  const info      = ownResult ?? (await checkGitHub());
  await writeCache(info);
  return info;
}

/** Check and cache; always returns a result without throwing. */
export async function checkAndCacheUpdate(forceRefresh = false): Promise<UpdateInfo> {
  return checkForUpdate(forceRefresh);
}

/** Read the persisted cache without hitting the network. */
export async function getCachedUpdate(): Promise<UpdateInfo | null> {
  const cached = await readCache();
  return cached ? cached.info : null;
}
