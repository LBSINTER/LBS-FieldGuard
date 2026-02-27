import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { decodePDU } from './PDUCodec';
import { RawPDUSender } from './RawPDUSender';
import { matchSignatures } from '../scanner/SignatureDB';
import { useAppStore } from '../store/appStore';
import { Alert, AlertCategory, RILEvent, RILEventType, Severity } from '../types';
import { nanoid } from '../utils/id';
import { notifyThreatAlert, startStickyMonitoring, stopStickyMonitoring } from '../services/NotificationService';

const RIL_BRIDGE = NativeModules.RILBridge as
  | { startMonitor: () => Promise<void>; stopMonitor: () => void }
  | undefined;
const AT_BRIDGE = NativeModules.FieldGuardAT as
  | { startMonitor: () => Promise<void>; stopMonitor: () => void }
  | undefined;

let _emitter: NativeEventEmitter | null = null;
let _atEmitter: NativeEventEmitter | null = null;
let _running = false;
let _logcatInterval: ReturnType<typeof setInterval> | null = null;
let _logcatOffset = 0;
const LOGCAT_PATH = `${RNFS.CachesDirectoryPath}/fg_ril_logcat.txt`;

const _recentAlerts = new Map<string, number>();
const DEDUPE_MS = 120_000;

const STK_CMD_TAGS = ['d0', '81030113', '81030115', '81030110', '81030112', '81030114'];
const WAP_PORT_2948 = '0b84';
const OMA_DM_PORT = 'c38f';

interface Finding {
  category: AlertCategory;
  severity: Severity;
  title: string;
  detail: string;
  explanation: string;
  references: string[];
}

export function startRILMonitor() {
  if (Platform.OS !== 'android') return;
  if (_running) return;
  _running = true;

  void _announceMonitoringCapabilities();

  if (RIL_BRIDGE) {
    try {
      if (!_emitter) _emitter = new NativeEventEmitter(NativeModules.RILBridge);
      RIL_BRIDGE.startMonitor().catch(() => _startLogcatFallback());
      _emitter.addListener('onRILMessage', _handleRILMessage);
      return;
    } catch {
      _startLogcatFallback();
    }
  }

  if (AT_BRIDGE) {
    try {
      if (!_atEmitter) _atEmitter = new NativeEventEmitter(NativeModules.FieldGuardAT);
      AT_BRIDGE.startMonitor().catch(() => {});
      _atEmitter.addListener('onATMessage', _handleATMessage);
    } catch {}
  }

  _startLogcatFallback();
}

export function stopRILMonitor() {
  if (!_running) return;
  _running = false;
  RIL_BRIDGE?.stopMonitor();
  AT_BRIDGE?.stopMonitor?.();
  _emitter?.removeAllListeners('onRILMessage');
  _atEmitter?.removeAllListeners('onATMessage');
  if (_logcatInterval) {
    clearInterval(_logcatInterval);
    _logcatInterval = null;
  }
  void stopStickyMonitoring();
}

async function _announceMonitoringCapabilities() {
  const hasRilBridge = !!RIL_BRIDGE;
  const hasAtBridge = !!AT_BRIDGE;
  const hasRaw = await RawPDUSender.isRawPduAvailable().catch(() => false);
  const hasRootHints = await Promise.all([
    RNFS.exists('/system/xbin/su').catch(() => false),
    RNFS.exists('/sbin/su').catch(() => false),
    RNFS.exists('/data/adb').catch(() => false),
  ]).then((a) => a.some(Boolean));
  const hasAtNode = await Promise.all([
    RNFS.exists('/dev/ttyUSB0').catch(() => false),
    RNFS.exists('/dev/ttyACM0').catch(() => false),
    RNFS.exists('/dev/smd0').catch(() => false),
    RNFS.exists('/dev/socket/rild').catch(() => false),
  ]).then((a) => a.some(Boolean));

  const mode = hasRilBridge && hasAtBridge && hasRaw && hasRootHints
    ? 'Full access mode'
    : hasRilBridge
      ? 'Enhanced mode'
      : 'Basic mode';

  const detail = hasRilBridge
    ? (hasRaw
      ? `RIL bridge active; raw PDU path available; AT ${hasAtBridge ? 'bridge active' : 'bridge unavailable'}; AT nodes ${hasAtNode ? 'present' : 'not detected'}.`
      : `RIL bridge active; raw PDU path unavailable on this device/version; AT ${hasAtBridge ? 'bridge active' : 'bridge unavailable'}; AT nodes ${hasAtNode ? 'present' : 'not detected'}.`)
    : `Broadcast-level SMS capture only; deep RIL/AT features unavailable (AT nodes ${hasAtNode ? 'present' : 'not detected'}).`;

  const { addAlert, setMonitoringCapabilities } = useAppStore.getState();
  setMonitoringCapabilities(mode, detail);
  addAlert({
    id: nanoid(),
    ts: Date.now(),
    severity: 'info',
    category: 'ril_anomaly',
    title: `Detection capability: ${mode}`,
    detail,
    explanation: `RIL bridge: ${hasRilBridge ? 'yes' : 'no'} · AT bridge: ${hasAtBridge ? 'yes' : 'no'} · Raw PDU: ${hasRaw ? 'yes' : 'no'} · AT node: ${hasAtNode ? 'yes' : 'no'} · Root indicators: ${hasRootHints ? 'yes' : 'no'}`,
  });

  void startStickyMonitoring(mode, detail);
}

function _handleATMessage(raw: unknown) {
  if (!raw) return;
  let command = '';
  let response = '';

  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as { command?: string; response?: string };
      command = String(p.command ?? '');
      response = String(p.response ?? '');
    } catch {
      command = String(raw);
    }
  } else if (typeof raw === 'object') {
    const p = raw as { command?: unknown; response?: unknown };
    command = String(p.command ?? '');
    response = String(p.response ?? '');
  }

  const cmd = command.toUpperCase();
  const rsp = response.toUpperCase();
  if (!cmd && !rsp) return;

  let finding: Finding | null = null;

  if (/AT\+COPS\s*=\s*2/.test(cmd)) {
    finding = {
      category: 'ril_anomaly',
      severity: 'high',
      title: 'AT command forces network deregistration',
      detail: 'AT+COPS=2 detected (manual deregister from network)',
      explanation: 'Forced deregistration can be used in rogue baseband control workflows to disrupt service or force reselection.',
      references: ['3GPP TS 27.007 (AT+COPS)'],
    };
  } else if (/AT\+CFUN\s*=\s*(0|1,1|4)/.test(cmd)) {
    finding = {
      category: 'ril_anomaly',
      severity: 'medium',
      title: 'AT command modifies modem functional state',
      detail: `Potential disruptive command detected: ${cmd.slice(0, 32)}`,
      explanation: 'Functional mode changes (CFUN) can disable radio or force modem restart.',
      references: ['3GPP TS 27.007 (AT+CFUN)'],
    };
  } else if (/AT\+(CSIM|CRSM)/.test(cmd) && /(D6|DC|UPDATE BINARY|UPDATE RECORD)/.test(`${cmd} ${rsp}`)) {
    finding = {
      category: 'ota_command',
      severity: 'high',
      title: 'AT SIM I/O write operation observed',
      detail: 'AT+CSIM/AT+CRSM write-like APDU pattern detected',
      explanation: 'SIM file write operations can alter UICC state and are security-sensitive outside expected provisioning flows.',
      references: ['3GPP TS 27.007', 'ETSI TS 102 221'],
    };
  } else if (/AT\+(QCFG|QNWINFO|ERAT|BAND)/.test(cmd) && /(LOCK|PREF|SET)/.test(`${cmd} ${rsp}`)) {
    finding = {
      category: 'ril_anomaly',
      severity: 'medium',
      title: 'AT radio band/rat setting change',
      detail: 'Band or RAT steering command observed via AT interface',
      explanation: 'Unexpected RAT/band steering can be associated with downgrade workflows and rogue cell steering.',
      references: ['Vendor AT command references'],
    };
  }

  if (finding) {
    const rawHex = _asciiToHex(`${command}\n${response}`).slice(0, 3000);
    _emitAlert(finding, rawHex, undefined, 'ril_unsol');
  }
}

function _asciiToHex(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) out += s.charCodeAt(i).toString(16).padStart(2, '0');
  return out;
}

function _parseNativeEventPayload(data: unknown): { type: string; hex: string } | null {
  if (!data) return null;

  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      if (parsed?.type && parsed?.hex) return { type: String(parsed.type), hex: String(parsed.hex) };
    } catch {
      return null;
    }
    return null;
  }

  if (typeof data === 'object') {
    const anyData = data as { type?: unknown; hex?: unknown };
    if (anyData.type && anyData.hex) {
      return { type: String(anyData.type), hex: String(anyData.hex) };
    }
  }

  return null;
}

function _handleRILMessage(raw: unknown) {
  const payload = _parseNativeEventPayload(raw);
  if (!payload) return;

  const { addRILEvent } = useAppStore.getState();
  const hex = payload.hex.replace(/\s/g, '').toLowerCase();
  if (!hex || !/^[0-9a-f]+$/.test(hex)) return;

  let decoded;
  try { decoded = decodePDU(hex); } catch {}

  const type = _mapType(payload.type);
  const finding = _analyseThreat(hex, decoded, type);

  const rilEvent: RILEvent = {
    id: nanoid(),
    ts: Date.now(),
    type,
    rawHex: hex,
    decoded,
    flagged: !!finding,
    flagReason: finding?.title,
  };
  addRILEvent(rilEvent);

  if (finding) {
    _emitAlert(finding, hex, decoded, type);
  }
}

function _startLogcatFallback() {
  async function _poll() {
    if (!_running) return;
    try {
      await RNFS.writeFile(LOGCAT_PATH, await _execLogcat(), 'utf8');
      const content = await RNFS.readFile(LOGCAT_PATH, 'utf8');
      const lines = content.split('\n').slice(_logcatOffset);
      _logcatOffset += lines.length;
      for (const line of lines) _parseLogcatLine(line.trim());
    } catch {}
  }

  _logcatInterval = setInterval(_poll, 8_000);
  void _poll();
}

async function _execLogcat(): Promise<string> {
  return new Promise((resolve) => {
    RNFS.readDir('/proc/self').then(() => resolve('')).catch(() => resolve(''));
  });
}

const PDU_RE = /(?:pdu|sms|deliver|submit|cb)[^\w].*?([0-9a-f]{20,})/i;

function _parseLogcatLine(line: string) {
  if (!line || line.startsWith('---')) return;
  const match = PDU_RE.exec(line);
  if (!match?.[1]) return;
  const hex = match[1].toLowerCase();

  let decoded;
  try { decoded = decodePDU(hex); } catch { return; }

  const type: RILEventType = /cb|cell broadcast/i.test(line) ? 'cell_broadcast' : 'sms_deliver';
  const finding = _analyseThreat(hex, decoded, type);
  const { addRILEvent } = useAppStore.getState();

  addRILEvent({
    id: nanoid(),
    ts: Date.now(),
    type,
    rawHex: hex,
    decoded,
    flagged: !!finding,
    flagReason: finding?.title,
  });

  if (finding) {
    _emitAlert(finding, hex, decoded, type);
  }
}

function _emitAlert(finding: Finding, hex: string, decoded: ReturnType<typeof decodePDU> | undefined, type: RILEventType) {
  const dedupeKey = `${finding.category}:${hex.slice(0, 90)}`;
  const now = Date.now();
  const prev = _recentAlerts.get(dedupeKey) ?? 0;
  if (now - prev < DEDUPE_MS) return;
  _recentAlerts.set(dedupeKey, now);

  for (const [key, ts] of _recentAlerts.entries()) {
    if (now - ts > DEDUPE_MS * 2) _recentAlerts.delete(key);
  }

  const { addAlert } = useAppStore.getState();

  addAlert({
    id: nanoid(),
    ts: now,
    severity: finding.severity,
    category: finding.category,
    title: finding.title,
    detail: finding.detail,
    raw: hex,
    pduFields: decoded,
    explanation: finding.explanation,
    references: finding.references,
  });

  const shouldNotify = finding.severity === 'critical' || finding.severity === 'high' || finding.severity === 'medium';
  if (shouldNotify) {
    void notifyThreatAlert(finding.title, finding.detail, finding.severity);
  }
}

function _analyseThreat(
  hex: string,
  decoded: ReturnType<typeof decodePDU> | undefined,
  type: RILEventType,
): Finding | null {
  if (!decoded) return null;

  if (decoded.udLen > 180) {
    return {
      category: 'ril_anomaly',
      severity: 'medium',
      title: 'Oversized TP-UD payload',
      detail: `User data length ${decoded.udLen} exceeds normal single-segment SMS profile`,
      explanation: 'Large user data with malformed segmentation or abnormal size can indicate crafted exploit-delivery payloads.',
      references: ['3GPP TS 23.040'],
    };
  }

  if (decoded.tpUdhi && (!decoded.udh || decoded.udh.length === 0)) {
    return {
      category: 'ril_anomaly',
      severity: 'medium',
      title: 'Malformed UDH indicator',
      detail: 'TP-UDHI flag set but no valid UDH elements decoded',
      explanation: 'Malformed headers are used by malformed-PDU fuzzing and parser bypass attempts.',
      references: ['3GPP TS 23.040 §9.2.3.24'],
    };
  }

  if (decoded.pid === 0x40) {
    return {
      category: 'silent_sms',
      severity: 'high',
      title: 'Type-0 silent SMS detected',
      detail: 'PID=0x40 (silent SMS) indicates covert reachability probing',
      explanation: 'Type-0 SMS is acknowledged by handset but not shown to user, commonly used for silent presence tracking.',
      references: ['3GPP TS 23.040 §9.2.3.9'],
    };
  }

  if (decoded.pid === 0x7f && decoded.binaryPayload?.toLowerCase().startsWith('d0')) {
    const cmd = decoded.binaryPayload.toLowerCase();
    const hasKnownStk = STK_CMD_TAGS.some((t) => cmd.includes(t));
    return {
      category: 'stk_proactive',
      severity: hasKnownStk ? 'critical' : 'high',
      title: 'STK proactive command payload',
      detail: hasKnownStk
        ? 'BER-TLV D0 STK command with known proactive command pattern'
        : 'BER-TLV D0 STK proactive command structure detected',
      explanation: 'Binary TP-UD with PID=0x7F and BER-TLV tag D0 indicates SIM Toolkit proactive command delivery.',
      references: ['ETSI TS 102 223', '3GPP TS 31.111'],
    };
  }

  const hasOtaIei = decoded.udh?.some((h) => h.iei === 0x70 || h.iei === 0x71) ?? false;
  if (hasOtaIei) {
    return {
      category: 'ota_command',
      severity: 'critical',
      title: 'SIM OTA control packet detected',
      detail: 'UDH IEI 0x70/0x71 indicates SIM OTA command/response transport',
      explanation: 'SIM OTA envelopes are passed to UICC applets and can trigger high-impact actions if OTA trust controls are weak.',
      references: ['3GPP TS 31.111', 'GSMA TS.48'],
    };
  }

  const port16 = decoded.udh?.find((h) => h.iei === 0x05)?.data?.toLowerCase() ?? '';
  if (port16.startsWith(WAP_PORT_2948) || port16.includes(WAP_PORT_2948) || port16.includes(OMA_DM_PORT)) {
    return {
      category: 'wap_push',
      severity: 'high',
      title: 'WAP/OMA port-addressed SMS',
      detail: `UDH port addressing targets WAP/OMA service port (${port16.slice(0, 8)})`,
      explanation: 'Binary WAP/OMA payload delivery to service ports is used for provisioning and has been abused in SMS exploit chains.',
      references: ['WAP-259-WSP', 'OMA-TS-DM_Protocol-V1_2'],
    };
  }

  if (decoded.dcsClass === 'class2' && decoded.dcsEncoding === 'binary') {
    return {
      category: 'binary_sms',
      severity: 'high',
      title: 'Class-2 binary SIM-directed SMS',
      detail: 'Binary TP-UD with class-2 delivery targets SIM storage/processing path',
      explanation: 'Class-2 binary SMS can be delivered to SIM/UICC handling paths and should be treated as security-sensitive.',
      references: ['3GPP TS 23.038 §4'],
    };
  }

  if (decoded.dcsClass === 'class3' && decoded.dcsEncoding === 'binary') {
    return {
      category: 'binary_sms',
      severity: 'medium',
      title: 'Class-3 binary TE-directed SMS',
      detail: 'Binary TP-UD with class-3 delivery targets external terminal equipment',
      explanation: 'Class-3 binary messages are uncommon on consumer devices and may indicate control-plane abuse.',
      references: ['3GPP TS 23.038 §4'],
    };
  }

  if (decoded.dcsClass === 'class0') {
    return {
      category: 'flash_sms',
      severity: 'low',
      title: 'Flash SMS (Class-0)',
      detail: 'Immediate-display message class observed',
      explanation: 'Class-0 itself is not always malicious but can be used in social engineering chains.',
      references: ['3GPP TS 23.038 §4'],
    };
  }

  const binary = decoded.binaryPayload?.toLowerCase() ?? '';
  if (binary && /(68747470|6874747073)/.test(binary)) {
    return {
      category: 'wap_push',
      severity: 'medium',
      title: 'Binary payload contains embedded URL',
      detail: 'Binary TP-UD contains http/https URL marker',
      explanation: 'Embedded URL markers inside binary SMS are commonly used in drive-by exploit and phishing delivery paths.',
      references: ['Citizen Lab mobile exploit analyses'],
    };
  }

  const sigHits = matchSignatures(hex, { maxMatches: 2 });
  if (sigHits.length > 0) {
    const hit = sigHits[0]!;
    return {
      category: hit.sig.category?.includes('pegasus') ? 'pegasus_indicator' : 'scanner_hit',
      severity: hit.sig.severity,
      title: `Signature hit: ${hit.sig.name}`,
      detail: `Matched byte signature ${hit.sig.id} at offset ${hit.offset}`,
      explanation: hit.sig.description,
      references: hit.sig.references ?? [],
    };
  }

  if (type === 'ril_unsol') {
    return {
      category: 'ril_anomaly',
      severity: 'medium',
      title: 'Unexpected unsolicited RIL payload',
      detail: 'Unsolicited RIL message included PDU-like hexadecimal payload',
      explanation: 'Unexpected unsolicited modem events carrying crafted payloads can indicate baseband probing attempts.',
      references: ['Android RIL unsolicited indications'],
    };
  }

  return null;
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
