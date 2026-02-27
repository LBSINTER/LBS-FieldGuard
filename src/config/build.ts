/**
 * LBS FieldGuard — Build-time Configuration
 */

// Current app version (must match android/app/build.gradle versionName)
export const APP_VERSION = '1.0.6';

// GitHub Releases API endpoint for update checks
export const RELEASES_API_URL =
  process.env['FIELDGUARD_RELEASES_URL'] ??
  'https://api.github.com/repos/LBSINTER/LBS-FieldGuardPublic/releases/latest';

// Station probe connection (legacy TCP probe to LBS backbone)
export const PROBE_HOST = '140.82.39.182';
export const PROBE_PORT = 5556;

// PC Bridge relay API — Android pushes events here; PC browser viewer polls same
export const RELAY_BASE_URL =
  process.env['FIELDGUARD_RELAY_URL'] ??
  'https://fieldguard.lbs-int.com/api.php';

// Misc
export const APP_NAME        = 'LBS FieldGuard';
export const GITHUB_REPO_URL = 'https://github.com/LBSINTER/LBS-FieldGuardPublic';
