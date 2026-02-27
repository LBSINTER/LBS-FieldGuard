/**
 * LBS FieldGuard — Log Uploader Service
 *
 * IMPORTANT: clearLogsAfterConfirm is ONLY callable when the relay server
 * has returned {safe_to_clear: true}, which means the stored SHA-256 matches
 * the SHA-256 we computed locally before upload.  If there is ANY mismatch,
 * local logs are NEVER deleted.
 */

import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '../store/appStore';
import { LogBundle, UploadState } from '../types';
import { RELAY_BASE_URL } from '../config/build';

const TMP_LOG_FILE = `${RNFS.CachesDirectoryPath}/fg_bundle.json`;

// ── Build a JSON bundle of all in-memory log data ─────────────────────────────
async function _buildBundle(): Promise<{ json: string; localSha256: string }> {
  const { alerts, rilEvents, pduLog, scanResults } = useAppStore.getState();
  const payload = {
    generatedAt: new Date().toISOString(),
    alerts,
    rilEvents,
    pduLog,
    scanResults,
  };
  const json = JSON.stringify(payload);
  // Write to temp file for SHA calc + upload
  await RNFS.writeFile(TMP_LOG_FILE, json, 'utf8');
  const localSha256 = await RNFS.hash(TMP_LOG_FILE, 'sha256');
  return { json, localSha256 };
}

// ── Main export: upload, confirm, and (only if confirmed) clear ───────────────
export async function uploadAndConfirmLogs(token: string): Promise<void> {
  const store = useAppStore.getState();
  const { setUploadState, setLastBundle, setUploadError, clearLogsAfterConfirm } = store;

  // -- 1. Build bundle ---------------------------------------------------------
  setUploadState('uploading');
  let json: string;
  let localSha256: string;
  try {
    ({ json, localSha256 } = await _buildBundle());
  } catch (e: any) {
    setUploadError('Failed to build log bundle: ' + e.message);
    setUploadState('error');
    return;
  }

  // -- 2. Upload ---------------------------------------------------------------
  const relayUrl = (await AsyncStorage.getItem('fg_relay_url')) ?? RELAY_BASE_URL;
  const filename = `fg_${new Date().getTime()}.json`;
  let logId: number;
  let sizeBytes: number;
  try {
    const res = await fetch(`${relayUrl}?action=upload_log`, {
      method: 'POST',
      headers: {
        'X-FG-Token':    token,
        'Content-Type':  'application/json',
        'X-FG-SHA256':   localSha256,
        'X-FG-Filename': filename,
      },
      body: json,
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error ?? 'upload_log failed');
    logId     = Number(data.log_id);
    sizeBytes = data.size_bytes;
  } catch (e: any) {
    setUploadError('Upload failed: ' + e.message);
    setUploadState('error');
    return;
  }

  // -- 3. Verify (confirm_upload) ----------------------------------------------
  setUploadState('verifying');
  let safe_to_clear = false;
  let serverSha256  = '';
  try {
    const res = await fetch(`${relayUrl}?action=confirm_upload&log_id=${logId}`, {
      headers: { 'X-FG-Token': token },
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error ?? 'confirm_upload failed');
    safe_to_clear = !!data.safe_to_clear;
    serverSha256  = data.stored_sha ?? '';
  } catch (e: any) {
    setUploadError('Checksum verification failed: ' + e.message);
    setUploadState('error');
    return;
  }

  // -- 4. Update bundle record -------------------------------------------------
  const bundle: LogBundle = {
    logId,
    sha256:       serverSha256,
    localSha256,
    sizeBytes:    sizeBytes ?? 0,
    filename,
    uploadState:  safe_to_clear ? 'confirmed' : 'error',
    confirmedAt:  safe_to_clear ? Date.now() : undefined,
  };
  setLastBundle(bundle);

  if (!safe_to_clear) {
    setUploadError(
      `SHA-256 mismatch — local: ${localSha256.slice(0, 12)}… server: ${serverSha256.slice(0, 12)}…  — logs NOT cleared`,
    );
    setUploadState('error');
    return;
  }

  // -- 5. Clear only after confirmed -------------------------------------------
  setUploadState('confirmed');
  clearLogsAfterConfirm();  // internally double-checks uploadState === 'confirmed'

  // Clean up temp file
  RNFS.unlink(TMP_LOG_FILE).catch(() => {});
}
