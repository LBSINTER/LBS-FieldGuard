/**
 * LBS FieldGuard — Auto-Update Checker
 *
 * Fetches the latest release from the configured GitHub Releases API endpoint
 * and compares it against the bundled APP_VERSION constant using semver rules.
 *
 * Usage:
 *   import { checkForUpdate, UpdateInfo } from './UpdateChecker';
 *   const info = await checkForUpdate();
 *   if (info.updateAvailable) { ... }
 *
 * Configure the API endpoint in src/config/build.ts (see that file for full
 * instructions on how to release a new version and trigger the in-app prompt).
 */

import { APP_VERSION, RELEASES_API_URL } from '../config/build';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GithubReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
  content_type: string;
}

export interface GithubRelease {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  published_at: string;
  prerelease: boolean;
  assets: GithubReleaseAsset[];
}

export interface UpdateInfo {
  updateAvailable: boolean;
  /** Current version bundled in this build, e.g. "1.0.1" */
  currentVersion: string;
  /** Latest version from the API, e.g. "1.1.0" — undefined if check failed */
  latestVersion?: string;
  /** Release notes (markdown body from GitHub) */
  releaseNotes?: string;
  /** Direct APK download URL if an .apk asset is attached; else GitHub page */
  downloadUrl?: string;
  /** Full GitHub release page */
  releasePageUrl?: string;
  /** ISO 8601 publish date of the latest release */
  publishedAt?: string;
  /** Error message if the check failed */
  error?: string;
}

// ── Semver helpers ────────────────────────────────────────────────────────────

/**
 * Parse "vX.Y.Z" or "X.Y.Z" into [major, minor, patch] numbers.
 * Returns [0, 0, 0] on malformed input so comparisons degrade gracefully.
 */
function parseSemver(tag: string): [number, number, number] {
  const clean = tag.replace(/^v/i, '').split('-')[0]; // strip pre-release suffix
  const parts = clean.split('.').map(Number);
  const [major = 0, minor = 0, patch = 0] = parts;
  return [major, minor, patch];
}

/**
 * Returns true when `candidate` is strictly greater than `current`.
 */
function isNewer(current: string, candidate: string): boolean {
  const [cMaj, cMin, cPat] = parseSemver(current);
  const [nMaj, nMin, nPat] = parseSemver(candidate);

  if (nMaj !== cMaj) return nMaj > cMaj;
  if (nMin !== cMin) return nMin > cMin;
  return nPat > cPat;
}

// ── Core check ────────────────────────────────────────────────────────────────

/**
 * Check the configured releases endpoint for a version newer than APP_VERSION.
 *
 * The function never throws — errors are returned in `UpdateInfo.error`.
 * It respects a 10-second timeout so it doesn't stall app start-up.
 */
export async function checkForUpdate(): Promise<UpdateInfo> {
  const base: UpdateInfo = {
    updateAvailable: false,
    currentVersion: APP_VERSION,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(RELEASES_API_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `LBSFieldGuard/${APP_VERSION}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { ...base, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const release: GithubRelease = await response.json();
    const latestVersion = release.tag_name;

    if (!latestVersion) {
      return { ...base, error: 'tag_name missing from API response' };
    }

    // Skip pre-release builds unless you want to notify about betas
    if (release.prerelease) {
      return { ...base, latestVersion };
    }

    const apkAsset = release.assets?.find(
      (a) => a.name.toLowerCase().endsWith('.apk')
    );

    const updateAvailable = isNewer(APP_VERSION, latestVersion);

    return {
      updateAvailable,
      currentVersion: APP_VERSION,
      latestVersion,
      releaseNotes: release.body || undefined,
      downloadUrl: apkAsset?.browser_download_url ?? release.html_url,
      releasePageUrl: release.html_url,
      publishedAt: release.published_at,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ...base, error: 'Update check timed out' };
    }
    return {
      ...base,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Return the stored UpdateInfo from the last check without hitting the network.
 * Call `checkForUpdate()` first to populate the cache.
 */
let _cachedUpdate: UpdateInfo | null = null;

export async function getCachedUpdate(): Promise<UpdateInfo | null> {
  return _cachedUpdate;
}

/**
 * Check for updates and cache the result for later retrieval.
 */
export async function checkAndCacheUpdate(): Promise<UpdateInfo> {
  const info = await checkForUpdate();
  _cachedUpdate = info;
  return info;
}
