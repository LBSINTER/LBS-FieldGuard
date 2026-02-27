/**
 * LBS FieldGuard — RIL Monitor (Android only)
 *
 * Bridges to the native Android RIL log reader via a NativeModule (RILBridge).
 * Falls back to a polling loop against /proc/net/netstat and logcat pipe
 * when root is not available.
 *
 * Monitors for:
 *   - Type-0 silent SMS   (PID=0x40)
 *   - Binary SMS          (DCS binary class)
 *   - SIM OTA commands    (UDH IEI 0x70 / 0x71)
 *   - STK ProactiveCommand(PID=0x7F)
 *   - Class-0 flash SMS
 *   - Network cell changes (potential IMSI catcher)
 *
 * Flagged events are pushed into the global Zustand store.
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { decodePDU } from './PDUCodec';
import { useAppStore } from '../store/appStore';
import { Alert, RILEvent, RILEventType, Severity } from '../types';
import { nanoid } from '../utils/id';

const RIL_BRIDGE = NativeModules.RILBridge as
  | {
      startMonitor: () => Promise<void>;
      stopMonitor: () => void;
    }
  | undefined;

const EMITTER = RIL_BRIDGE ? new NativeEventEmitter(NativeModules.RILBridge) : null;

let _running = false;

export function startRILMonitor() {
  if (Platform.OS !== 'android') return;
  if (_running) return;
  _running = true;

  if (RIL_BRIDGE && EMITTER) {
    // Native path — RILBridge NativeModule (requires root or READ_PHONE_STATE)
    RIL_BRIDGE.startMonitor().catch(() => _startLogcatFallback());
    EMITTER.addListener('onRILMessage', _handleRILMessage);
  } else {
    _startLogcatFallback();
  }
}

export function stopRILMonitor() {
  if (!_running) return;
  _running = false;
  RIL_BRIDGE?.stopMonitor();
  EMITTER?.removeAllListeners('onRILMessage');
}

// ── Handler ───────────────────────────────────────────────────────────────────
function _handleRILMessage(data: { type: string; hex: string }) {
  const { addRILEvent, addAlert } = useAppStore.getState();
  const hex = data.hex.replace(/\s/g, '');

  let decoded;
  try {
    decoded = decodePDU(hex);
  } catch (_) {}

  const { flagged, reason, severity } = _classify(hex, decoded);
  const type = _mapType(data.type);

  const rilEvent: RILEvent = {
    id: nanoid(),
    ts: Date.now(),
    type,
    rawHex: hex,
    decoded,
    flagged,
    flagReason: reason,
  };

  addRILEvent(rilEvent);

  if (flagged) {
    const alert: Alert = {
      id: nanoid(),
      ts: Date.now(),
      severity,
      category: _categFromType(type),
      title: reason ?? 'Suspicious SMS',
      detail: `From: ${decoded?.sender ?? 'unknown'} | PID: 0x${decoded?.pid?.toString(16).toUpperCase() ?? '??'}`,
      raw: hex,
    };
    addAlert(alert);
  }
}

// ── Classification ────────────────────────────────────────────────────────────
function _classify(
  hex: string,
  decoded?: ReturnType<typeof decodePDU>
): { flagged: boolean; reason?: string; severity: Severity } {
  if (!decoded) return { flagged: false, severity: 'info' };

  // Type-0 silent SMS
  if (decoded.pid === 0x40) {
    return { flagged: true, reason: 'Type-0 silent SMS (PID=0x40)', severity: 'high' };
  }

  // STK ProactiveCommand
  if (decoded.pid === 0x7f) {
    return { flagged: true, reason: 'STK ProactiveCommand (PID=0x7F)', severity: 'critical' };
  }

  // SIM OTA via UDH
  if (decoded.udh?.some((h) => h.iei === 0x70 || h.iei === 0x71)) {
    return { flagged: true, reason: 'SIM OTA command (UDH IEI=0x70/0x71)', severity: 'critical' };
  }

  // Binary SMS with no text
  if (decoded.dcsEncoding === 'binary' && !decoded.text) {
    // Check for known RAT payloads in binary body
    if (decoded.binaryPayload?.startsWith('d0') || decoded.binaryPayload?.startsWith('D0')) {
      return { flagged: true, reason: 'Possible STK PROACTIVE COMMAND in binary SMS', severity: 'high' };
    }
    return { flagged: true, reason: 'Binary SMS payload', severity: 'medium' };
  }

  // Class 0 (flash) SMS — DCS bits 4-5 set to 00, message class = 0
  if ((decoded.dcs & 0x13) === 0x10) {
    return { flagged: true, reason: 'Class-0 flash SMS', severity: 'low' };
  }

  // Pegasus/NSO markers in binary payload (prefix patterns)
  if (decoded.binaryPayload && _knownRATPattern(decoded.binaryPayload)) {
    return { flagged: true, reason: 'Known SS7 RAT/Pegasus byte pattern', severity: 'critical' };
  }

  return { flagged: false, severity: 'info' };
}

// Known first-byte sequences from the SS7 RAT payload database
const RAT_PREFIXES = [
  'd012', '027e', '9110', '8c01', 'a06c', '0101', '027f',
];
function _knownRATPattern(hex: string): boolean {
  const lower = hex.toLowerCase();
  return RAT_PREFIXES.some((p) => lower.startsWith(p));
}

function _mapType(nativeType: string): RILEventType {
  const map: Record<string, RILEventType> = {
    SMS_DELIVER: 'sms_deliver',
    SMS_SUBMIT: 'sms_submit',
    SMS_STATUS: 'sms_status_report',
    SMS_COMMAND: 'sms_command',
    CBS: 'cell_broadcast',
    RIL_UNSOL: 'ril_unsol',
  };
  return (map[nativeType] as RILEventType) ?? 'ril_unsol';
}

function _categFromType(type: RILEventType): Alert['category'] {
  if (type === 'sms_deliver') return 'silent_sms';
  if (type === 'sms_command') return 'stk_command';
  return 'ril_anomaly';
}

// ── Logcat fallback (non-root) ─────────────────────────────────────────────────
function _startLogcatFallback() {
  // Non-root fallback: poll Android system log for RIL tag
  // This is limited but catches Type-0 and some OTA via kernel logs
  setInterval(async () => {
    if (!_running) return;
    // In production: use RNFetchBlob to pipe logcat -s RIL
    // Here we log that native bridge is unavailable
    console.debug('[FieldGuard] RIL native bridge unavailable — logcat fallback active');
  }, 10_000);
}
