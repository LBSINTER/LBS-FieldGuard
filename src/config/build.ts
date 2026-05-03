/**
 * LBS FieldGuard — Build-time Configuration
 *
 * PC Bridge: the handset posts to the relay `api.php`; the browser PIN viewer is `viewer.html`
 * on the same origin. Always derive the viewer URL from the relay API URL unless
 * `FIELDGUARD_VIEWER_URL` overrides (rare).
 */

// Current app version (must match android/app/build.gradle versionName)
export const APP_VERSION = '1.1.0';

// GitHub Releases API endpoint for update checks
export const RELEASES_API_URL =
  process.env['FIELDGUARD_RELEASES_URL'] ??
  'https://api.github.com/repos/LBSINTER/LBS-FieldGuard/releases/latest';

// Station probe connection (legacy TCP probe to LBS backbone)
export const PROBE_HOST = '140.82.39.182';
export const PROBE_PORT = 5556;

// PC Bridge relay API — Android pushes events here; PC browser viewer polls same host.
export const RELAY_BASE_URL =
  process.env['FIELDGUARD_RELAY_URL'] ??
  'https://fieldguard.lbs-int.com/api.php';

/**
 * Map relay API URL (…/api.php) to the PIN viewer on the same host/path prefix.
 * Keeps sessions and PINs consistent when Settings points at e.g. field.gsmmap.com.
 */
export function relayApiUrlToViewerPinUrl(relayApiUrl: string): string {
  const raw = relayApiUrl.trim();
  if (!raw) return 'https://fieldguard.lbs-int.com/viewer.html#pin';
  try {
    const u = new URL(raw);
    u.pathname = u.pathname.replace(/\/api\.php$/i, '/viewer.html');
    u.search = '';
    u.hash = 'pin';
    return u.toString();
  } catch {
    return 'https://fieldguard.lbs-int.com/viewer.html#pin';
  }
}

/** Default browser viewer; override with FIELDGUARD_VIEWER_URL only if relay layout is non-standard. */
export const PC_BRIDGE_VIEWER_URL =
  process.env['FIELDGUARD_VIEWER_URL'] ?? relayApiUrlToViewerPinUrl(RELAY_BASE_URL);

// Misc
export const APP_NAME        = 'LBS FieldGuard';
export const GITHUB_REPO_URL = 'https://github.com/LBSINTER/LBS-FieldGuard';
