/**
 * LBS FieldGuard — Shared TypeScript types
 */

// ─── Severity ────────────────────────────────────────────────────────────────
export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

// ─── Alert ───────────────────────────────────────────────────────────────────
export interface Alert {
  id: string;
  ts: number;          // Unix ms
  severity: Severity;
  category: AlertCategory;
  title: string;
  detail: string;
  raw?: string;        // raw PDU hex or packet hex
}

export type AlertCategory =
  | 'silent_sms'
  | 'ota_update'
  | 'stk_command'
  | 'ussd_push'
  | 'binary_sms'
  | 'rat_payload'
  | 'nso_pattern'
  | 'ss7_probe'
  | 'ril_anomaly'
  | 'packet_anomaly'
  | 'scanner_hit';

// ─── Scan result ─────────────────────────────────────────────────────────────
export interface ScanResult {
  id: string;
  ts: number;
  filePath: string;
  fileName: string;
  fileSize: number;
  verdict: 'clean' | 'suspicious' | 'malicious';
  matchedSignatures: SignatureMatch[];
  sha256: string;
}

export interface SignatureMatch {
  sigId: string;
  name: string;
  category: string;
  offset: number;
  length: number;
}

// ─── Byte-pattern signature ───────────────────────────────────────────────────
export interface ByteSignature {
  id: string;
  name: string;
  category: string;       // 'pegasus' | 'nso' | 'ss7' | 'rat' | 'stk' | 'ota' | 'malware'
  severity: Severity;
  pattern: string;        // hex string, e.g. "d0 12 81 03 01 21 00 82 02 81 82"
  mask?: string;          // optional mask (same length), FF = must match
  description: string;
}

// ─── RIL event ───────────────────────────────────────────────────────────────
export interface RILEvent {
  id: string;
  ts: number;
  type: RILEventType;
  rawHex: string;
  decoded?: Partial<PDUDecoded>;
  flagged: boolean;
  flagReason?: string;
}

export type RILEventType =
  | 'sms_deliver'
  | 'sms_submit'
  | 'sms_status_report'
  | 'sms_command'
  | 'cell_broadcast'
  | 'ril_unsol'
  | 'type0_silent';

// ─── PDU decoded ─────────────────────────────────────────────────────────────
export interface PDUDecoded {
  smsc: string;
  smscType: number;
  tpMti: number;
  tpMms: boolean;
  tpSri: boolean;
  tpUdhi: boolean;
  sender: string;
  senderType: number;
  pid: number;
  dcs: number;
  dcsEncoding: 'gsm7' | 'ucs2' | 'binary' | 'unknown';
  timestamp: string;
  udLen: number;
  udh?: UDHHeader[];
  text?: string;
  binaryPayload?: string;  // hex
}

export interface UDHHeader {
  iei: number;
  data: string;  // hex
}

// ─── PDU record (builder log) ─────────────────────────────────────────────────
export interface PDURecord {
  id: string;
  ts: number;
  direction: 'built' | 'captured';
  rawHex: string;
  decoded: PDUDecoded;
  label?: string;
}

// ─── Probe status ─────────────────────────────────────────────────────────────
export type ProbeStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface ProbeMessage {
  type: 'alert' | 'ril_event' | 'pong' | 'ack' | 'sig_update';
  id: string;
  ts: number;
  payload: unknown;
}
