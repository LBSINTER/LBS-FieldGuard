/**
 * LBS FieldGuard — Shared TypeScript types
 * All detections reference real specifications and real technical context.
 */

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

// Alert — a flagged event with optional byte-level detection context
export interface Alert {
  id:          string;
  ts:          number;
  severity:    Severity;
  category:    AlertCategory;
  title:       string;
  detail:      string;          // human-readable detection explanation
  raw?:        string;          // full PDU hex string
  sigId?:      string;          // signature DB entry ID if byte-pattern match
  sigOffset?:  number;          // byte offset of matched pattern in raw
  sigLen?:     number;          // length of matched pattern in bytes
  pduFields?:  Partial<PDUDecoded>;  // decoded PDU fields if available
  references?: string[];        // spec/research references
  explanation?:string;          // long-form technical explanation
}

/**
 * Alert categories — named by the actual protocol event, not generic labels.
 * These map 1:1 to detection logic in RILMonitor and PacketAnalyser.
 */
export type AlertCategory =
  | 'silent_sms'          // PID=0x40 Type-0: handset-discard silent ping (3GPP TS 23.040)
  | 'ota_command'         // SIM OTA via UDH IEI 0x70/0x71 (3GPP TS 31.111)
  | 'stk_proactive'       // STK Proactive Command tag D0 (ETSI TS 102.223)
  | 'ussd_push'           // Unsolicited USSD MAP PSI/PUSS request
  | 'binary_sms'          // DCS class 2/3 binary SMS (SIM/TE delivery)
  | 'flash_sms'           // DCS class 0 immediate-display SMS
  | 'wap_push'            // WAP Push via UDP port 2948 (WSP, WBXML)
  | 'map_sri_sm'          // SS7 MAP Send Routing Info for SM (SRI-SM)
  | 'map_ati'             // SS7 MAP Any-Time Interrogation
  | 'map_isd'             // SS7 MAP Insert Subscriber Data
  | 'map_cl'              // SS7 MAP Cancel Location
  | 'sigtran_probe'       // M2PA/M3UA/SCCP connection observation
  | 'ril_anomaly'         // RIL layer unexpected unsolicited response
  | 'packet_anomaly'      // VPN-captured IP packet anomaly
  | 'scanner_hit'         // Byte-pattern signature match in file/PDU
  | 'pegasus_indicator'   // NSO Pegasus implant byte-pattern match (Amnesty/CitizenLab sigs)
  | 'cell_broadcast'      // Cell Broadcast message (ETSI TS 123.041)
  | 'imsi_catcher'        // Rogue BTS / forced 2G downgrade indicator
  | 'pdp_manipulation';   // GTP Create Session / Update Bearer anomaly

export interface ScanResult {
  id:                 string;
  ts:                 number;
  filePath:           string;
  fileName:           string;
  fileSize:           number;
  verdict:            'clean' | 'suspicious' | 'malicious';
  matchedSignatures:  SignatureMatch[];
  sha256:             string;
}

export interface SignatureMatch {
  sigId:    string;
  name:     string;
  category: string;
  offset:   number;
  length:   number;
}

export interface ByteSignature {
  id:          string;
  name:        string;
  category:    string;
  severity:    Severity;
  pattern:     string;          // hex bytes separated by spaces
  mask?:       string;          // FF=must match, 00=wildcard
  description: string;
  references?: string[];
}

export interface RILEvent {
  id:        string;
  ts:        number;
  type:      RILEventType;
  rawHex:    string;
  decoded?:  Partial<PDUDecoded>;
  flagged:   boolean;
  flagReason?: string;
}

export type RILEventType =
  | 'sms_deliver'
  | 'sms_submit'
  | 'sms_status_report'
  | 'sms_command'
  | 'cell_broadcast'
  | 'ril_unsol'
  | 'type0_silent'
  | 'wap_push'
  | 'ota_sms_pp';

export interface PDUDecoded {
  smsc:          string;
  smscType:      number;
  tpMti:         number;           // TP-MTI: 0=DELIVER, 1=SUBMIT, 2=STATUS-REPORT
  tpMms:         boolean;
  tpSri:         boolean;
  tpUdhi:        boolean;
  tpRp:          boolean;          // Reply-Path
  sender:        string;
  senderType:    number;           // 145=international, 161=national, 129=unknown
  pid:           number;
  dcs:           number;
  dcsClassBits:  number;           // bits 0-1 of DCS
  dcsEncoding:   'gsm7' | 'ucs2' | 'binary' | 'unknown';
  dcsClass:      'class0'|'class1'|'class2'|'class3'|'none';  // message class
  timestamp:     string;
  udLen:         number;
  udh?:          UDHHeader[];
  text?:         string;
  binaryPayload?:string;
}

export interface UDHHeader {
  iei:  number;
  data: string;     // hex
  desc?: string;    // human description (from UDH_IEI_NOTES lookup)
}

export interface PDURecord {
  id:         string;
  ts:         number;
  direction:  'built' | 'captured' | 'sent';
  rawHex:     string;
  decoded:    PDUDecoded;
  label?:     string;
  sendResult?:'success'|'failed'|'pending';
}

export type ProbeStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface ProbeMessage {
  type:    'alert' | 'ril_event' | 'pong' | 'ack' | 'sig_update';
  id:      string;
  ts:      number;
  payload: unknown;
}

export interface BridgeSession {
  pin:         string;
  token:       string;
  sessionId:   string;        // public-facing session ID for share URL
  expiresAt:   string;
  pcConnected: boolean;
  publicShare: boolean;
  shareUrl?:   string;
}

export type UploadState =
  | 'idle'
  | 'uploading'
  | 'verifying'
  | 'confirmed'
  | 'error';

export interface LogBundle {
  logId:        number;
  sha256:       string;
  localSha256:  string;
  sizeBytes:    number;
  filename:     string;
  uploadState:  UploadState;
  confirmedAt?: number;
}

// ── Cell Measurement & IMSI Catcher ────────────────────────────────────────

export type CellTech = 'GSM' | 'WCDMA' | 'LTE' | 'NR' | 'CDMA' | 'unknown';

/**
 * A single serving-cell measurement snapshot — real device data only.
 * All optional fields reflect genuine Android API availability constraints.
 */
export interface CellMeasurement {
  id:         string;
  ts:         number;
  tech:       CellTech;
  mcc:        string;        // Mobile Country Code
  mnc:        string;        // Mobile Network Code
  lac:        number;        // Location Area Code (GSM/WCDMA) or TAC (LTE)
  cid:        number;        // Cell ID
  arfcn?:     number;        // Absolute Radio Frequency Channel Number
  pci?:       number;        // Physical Cell ID (LTE/NR)
  rssi?:      number;        // dBm
  rsrp?:      number;        // dBm (LTE/NR)
  rsrq?:      number;        // dB (LTE/NR)
  sinr?:      number;        // dB (LTE/NR)
  ta?:        number;        // Timing Advance (0 = <554m, 63 = max GSM range)
  neighbours: NeighbourCell[];
  latitude?:  number;
  longitude?: number;
}

export interface NeighbourCell {
  tech:   CellTech;
  mcc?:   string;
  mnc?:   string;
  lac?:   number;
  cid?:   number;
  arfcn?: number;
  pci?:   number;
  rssi?:  number;
  rsrp?:  number;
}

/**
 * IMSI Catcher detection event.
 * Uses MULTI-FACTOR scoring to eliminate false positives.
 * A single indicator NEVER triggers an alert alone.
 */
export interface IMSICatcherEvent {
  id:             string;
  ts:             number;
  score:          number;       // 0–10 accumulated evidence score
  verdict:        'clean' | 'suspicious' | 'likely' | 'confirmed';
  indicators:     IMSICatcherIndicator[];
  measurement:    CellMeasurement;
  alertGenerated: boolean;
}

export type IMSICatcherIndicatorType =
  | 'ta_zero'              // TA = 0 → BTS within 0–554 m (alone: info, combined: medium)
  | 'ta_sudden_change'     // TA changed from ≥3 to 0 in same area
  | 'cipher_a5_0'          // No encryption — A5/0 reported via AT+CPAS or system log
  | 'cipher_a5_2'          // Weak cipher (A5/2) — illegal in most jurisdictions
  | 'forced_2g_downgrade'  // Dropped from LTE/UMTS to GSM unexpectedly
  | 'arfcn_rogue'          // ARFCN outside carrier's known band plan
  | 'lac_sudden_change'    // LAC changed without user moving (>2 km movement required)
  | 'signal_anomaly'       // Unusually strong signal from unregistered cell
  | 'cell_id_unregistered' // CID not in carrier's public cell database
  | 'rapid_reselection';   // Cell reselected >3 times within 60 seconds

export interface IMSICatcherIndicator {
  type:        IMSICatcherIndicatorType;
  score:       number;          // individual weight
  description: string;          // human-readable full explanation
  data:        Record<string, string | number | boolean>;  // supporting evidence
}

// ── AT Command Interface ────────────────────────────────────────────────────

export interface ATDevice {
  path:      string;      // /dev/ttyUSB0, /dev/smd0, etc.
  type:      'ttyUSB' | 'ttyACM' | 'smd' | 'ril_socket' | 'other';
  readable:  boolean;
  writable:  boolean;
  confirmed: boolean;     // responded to AT\r with OK
}

export interface ATCommandRecord {
  id:          string;
  ts:          number;
  command:     string;    // the AT command sent
  response:    string;    // raw response string
  durationMs:  number;
  devicePath:  string;
  ok:          boolean;
}

export interface ATModemInfo {
  manufacturer?: string;   // AT+CGMI
  model?:        string;   // AT+CGMM
  revision?:     string;   // AT+CGMR
  imei?:         string;   // AT+CGSN
  imsi?:         string;   // AT+CIMI
  signal?:       string;   // AT+CSQ
  networkReg?:   string;   // AT+CREG?
  operator?:     string;   // AT+COPS?
  cipherMode?:   string;   // AT+CSCA or vendor AT+GETCS response
  band?:         string;   // AT+QNWINFO or AT%GETCFG="BAND"
  neighbors?:    string;   // AT+QENG="neighbourcell" or AT%NWSCAN
}

// ── Device Capability ───────────────────────────────────────────────────────

export interface CapabilityResult {
  id:               string;
  ts:               number;
  score:            number;         // 0–18
  maxScore:         number;         // always 18
  root:             boolean;
  rilSocket:        boolean;
  atDevices:        ATDevice[];
  atConfirmed:      boolean;        // any AT device responded with OK
  telephonyPerms:   boolean;        // READ_PHONE_STATE granted
  locationPerms:    boolean;        // FINE location granted
  timingAdvance:    boolean;        // TA available (API 28+)
  neighborCells:    boolean;        // getAllCellInfo() returns neighbors
  cipherIndicator:  boolean;        // can read A5 mode (system/root)
  simoAccess:       boolean;        // can read SIM OTA channel
  imsiRead:         boolean;        // getSubscriberId() returned non-null
  iccidRead:        boolean;        // getSimSerialNumber() returned non-null
  imeiRead:         boolean;        // getDeviceId() returned non-null
  authChallengeLog: boolean;        // RIL RAND logging available
  pdpContext:       boolean;        // getDataNetworkType() available
  items:            CapabilityItem[];
}

export interface CapabilityItem {
  name:        string;
  description: string;
  available:   boolean;
  score:       number;     // score contributed when available
  requires:    'none' | 'root' | 'system';
  method:      string;     // how it's detected
}

// ── Subscriber Identity ─────────────────────────────────────────────────────

export interface SubscriberInfo {
  ts:          number;
  imsi?:       string;    // TelephonyManager.getSubscriberId()
  iccid?:      string;    // TelephonyManager.getSimSerialNumber()
  imei?:       string;    // TelephonyManager.getImei()
  imeisv?:     string;    // TelephonyManager.getDeviceSoftwareVersion()
  msisdn?:     string;    // TelephonyManager.getLine1Number()
  carrier?:    string;    // getNetworkOperatorName()
  mcc?:        string;
  mnc?:        string;
  simState?:   number;    // SIM_STATE_* constant
  simChanged?:  boolean;   // ICCID changed since last launch
  dual?:        boolean;   // dual SIM device
}

// ── Auth Event Monitor ──────────────────────────────────────────────────────

export interface AuthEvent {
  id:      string;
  ts:      number;
  rand:    string;    // 16-byte RAND challenge hex
  sres?:   string;    // 4-byte SRES response hex (root only)
  kc?:     string;    // Kc session key hex (root only)
  source:  'ril_io' | 'logcat' | 'aidl';
  note?:   string;
}

// Settings stored in AsyncStorage
export interface AppSettings {
  probeHost:         string;
  probePort:         string;
  relayUrl:          string;
  connectedNetUrl:   string;
  shareReports:      boolean;   // did user consent to global report sharing?
  shareMinSeverity:  Severity;  // min severity to share (default: high)
  shareLowEnabled:   boolean;   // explicitly share low/info (default: false)
  deviceId:          string;
  onboardingDone:    boolean;
  darkMode:          boolean;
  deepScan:          boolean;
  vpnDetect:         boolean;
}
