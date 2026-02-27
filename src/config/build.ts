/**
 * LBS FieldGuard — Build-time Configuration
 *
 * Override these values by editing this file before building, or by using
 * the CI/CD environment variables described below.
 *
 * ─── How to update the version and trigger the auto-update notification ───────
 *
 * 1. Bump `APP_VERSION` in this file to match the new release tag you plan to
 *    push. The in-app update prompt fires when the GitHub release tag is *later*
 *    than this constant (semver comparison).
 *
 * 2. Update `android/app/build.gradle`:
 *      versionCode   <- must be incremented each release
 *      versionName   <- should match APP_VERSION
 *
 * 3. Commit, tag, and push:
 *      git add .
 *      git commit -m "chore: bump to vX.Y.Z"
 *      git tag vX.Y.Z
 *      git push && git push --tags
 *    → The GitHub Actions workflow (`.github/workflows/build-apk.yml`) will:
 *      • Build the release APK automatically
 *      • Create a GitHub Release with the APK attached
 *    → Existing installed apps will detect the new release on next launch and
 *      show the update banner.
 *
 * ─── Build-time URL override (CI/CD) ─────────────────────────────────────────
 *
 * In the GitHub Actions workflow (or any CI system), run this before building:
 *
 *   sed -i "s|RELEASES_URL_PLACEHOLDER|https://your-custom-endpoint|g" \
 *       src/config/build.ts
 *
 * Or set FIELDGUARD_RELEASES_URL as a CI env var and use the babel transform
 * plugin `babel-plugin-transform-inline-environment-variables`.
 */

// ── Current app version (must match android/app/build.gradle versionName) ────
export const APP_VERSION = '1.0.3';

// ── GitHub Releases API endpoint used for update checks ──────────────────────
// To use a self-hosted endpoint, the response must be GH-compatible JSON with
// at least: { "tag_name": "v1.2.3", "assets": [...], "html_url": "..." }
export const RELEASES_API_URL =
  process.env['FIELDGUARD_RELEASES_URL'] ??
  'https://api.github.com/repos/LBSINTER/LBS-FieldGuardPublic/releases/latest';

// ── Probe configuration ───────────────────────────────────────────────────────
export const PROBE_HOST = '140.82.39.182';
export const PROBE_PORT = 5556;

// ── Misc ──────────────────────────────────────────────────────────────────────
export const APP_NAME         = 'LBS FieldGuard';
export const GITHUB_REPO_URL  = 'https://github.com/LBSINTER/LBS-FieldGuardPublic';
