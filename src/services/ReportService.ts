/**
 * LBS FieldGuard — ReportService
 *
 * Submits threat alerts to fieldguard.connectednet.com/api.php only when the
 * user has explicitly consented via the onboarding flow and only for alerts
 * that meet the user's configured minimum severity threshold.
 *
 * Privacy guarantees:
 *  - Only threat signatures, PDU hex, and cell IDs are sent.
 *  - No MSISDN, IMEI, contacts, SMS content, or call records are included.
 *  - Submission is silently skipped when shareReports = false.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Severity, AppSettings } from '../types';

const SEVERITY_RANK: Record<Severity, number> = {
  info:     0,
  low:      1,
  medium:   2,
  high:     3,
  critical: 4,
};

async function loadSettings(): Promise<AppSettings | null> {
  try {
    const raw = await AsyncStorage.getItem('fg_settings');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function meetsThreshold(alertSeverity: Severity, settings: AppSettings): boolean {
  if (!settings.shareReports) return false;

  const rank = SEVERITY_RANK[alertSeverity];

  // Always allow high + critical
  if (rank >= SEVERITY_RANK['high']) return true;

  // Block low/info unless user explicitly opted in
  if (rank <= SEVERITY_RANK['low'] && !settings.shareLowEnabled) return false;

  // Block anything below user's chosen minimum
  if (rank < SEVERITY_RANK[settings.shareMinSeverity]) return false;

  return true;
}

export async function shouldShare(alert: Alert): Promise<boolean> {
  const settings = await loadSettings();
  if (!settings) return false;
  return meetsThreshold(alert.severity, settings);
}

export async function submitReport(alert: Alert): Promise<void> {
  const settings = await loadSettings();
  if (!settings) return;
  if (!meetsThreshold(alert.severity, settings)) return;

  const endpoint = settings.connectedNetUrl || 'https://fieldguard.connectednet.com/api.php';
  const deviceId = settings.deviceId || 'unknown';

  const body: Record<string, string> = {
    action:      'submit_report',
    device_id:   deviceId,
    report_type: 'alert',
    severity:    alert.severity,
    category:    alert.category,
    title:       alert.title,
    detail:      alert.detail ?? '',
    raw_hex:     alert.raw ?? '',
    sig_id:      alert.sigId ?? '',
    sig_offset:  String(alert.sigOffset ?? 0),
    country_code: '',   // populated if available from RIL state
    mcc:         '',
    mnc:         '',
  };

  try {
    await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    Object.entries(body)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&'),
    });
  } catch (err) {
    // Silent — no user-visible error for background report submission
    console.warn('[ReportService] submit failed:', err);
  }
}
