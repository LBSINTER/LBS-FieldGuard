/**
 * LBS FieldGuard — Alert Annotations
 *
 * Human-readable notes and per-category technical detail for the alert
 * detail modal.  All explanations are factual and reference actual 3GPP
 * specifications or publicly documented security research.
 */

import { AlertCategory } from '../types';

// ── PID byte → explanation ────────────────────────────────────────────────────
export const PID_NOTES: Record<number, string> = {
  0x00: 'Standard SM-to-SM transfer',
  0x01: 'Replace Short Message type 1 — replaces previous SM of same type in ME storage',
  0x02: 'Replace Short Message type 2',
  0x03: 'Replace Short Message type 3',
  0x04: 'Replace Short Message type 4',
  0x05: 'Replace Short Message type 5',
  0x06: 'Replace Short Message type 6',
  0x07: 'Replace Short Message type 7',
  0x3F: 'SC-specific use (defined by SMSC vendor)',
  0x40: 'TYPE-0 SILENT SMS — handset MUST discard after processing. No store, no notify. Used for subscriber presence detection and TMSI tracking (3GPP TS 23.040 §9.2.3.9)',
  0x5E: 'ME De-personalisation Short Message — used for SIM-lock override',
  0x5F: 'Return Call Message — triggers call-back to originating address',
  0x7D: 'ANSI-136 R-DATA — GSM/ANSI-136 interworking message',
  0x7E: 'ME Data Download — delivers data directly to ME without user interaction',
  0x7F: 'SIM Data Download — delivered to SIM Card by ME (3GPP TS 31.111 §4)',
};

// ── DCS lower nibble → message class description ──────────────────────────────
export const DCS_NOTES: Record<number, string> = {
  0x00: 'GSM-7 default alphabet, no message class',
  0x04: '8-bit binary data, no message class',
  0x08: 'UCS-2 (UTF-16BE), no message class',
  0x10: 'CLASS 0: immediate display (flash SMS) — displayed immediately, not stored',
  0x11: 'CLASS 1: ME default storage',
  0x12: 'CLASS 2: SIM-specific storage — delivered to SIM EF_SMS',
  0x13: 'CLASS 3: TE (terminal equipment) specific',
  0xC0: 'Message Waiting Indication — discard group, voicemail: clear',
  0xC8: 'Message Waiting Indication — discard group, voicemail: set',
  0xD0: 'Message Waiting Indication — with store, text encoding GSM-7',
  0xD8: 'Message Waiting Indication — with store, combined flash+MWI',
  0xF0: 'DCS=0xF0 — Class 0 immediate, GSM-7',
  0xF1: 'DCS=0xF1 — Class 1 ME storage, GSM-7',
  0xF2: 'DCS=0xF2 — Class 2 SIM storage, 8-bit',
  0xF3: 'DCS=0xF3 — Class 3 TE specific, GSM-7',
  0xF5: 'DCS=0xF5 — Class 1 8-bit binary',
  0xF6: 'DCS=0xF6 — Class 2 8-bit binary (SIM storage)',
  0xF7: 'DCS=0xF7 — Class 3 8-bit binary',
};

// ── UDH IEI → description  ────────────────────────────────────────────────────
export const UDH_IEI_NOTES: Record<number, string> = {
  0x00: 'Concatenated Short Message (8-bit ref) — 3GPP TS 23.040 §9.2.3.24.1',
  0x01: 'Special SMS Message Indication — indicates voicemail/fax waiting',
  0x04: 'Application Port Addressing (8-bit) — routes SMS to specific app',
  0x05: 'Application Port Addressing (16-bit) — WAP (2948), OMA-DM (49999) etc.',
  0x08: 'Concatenated Short Message (16-bit ref)',
  0x0A: 'Text Formatting (EMS element — font, alignment, etc.)',
  0x0B: 'Predefined Sound (EMS)',
  0x0C: 'User Defined Sound (iMelody format, EMS)',
  0x0D: 'Predefined Animation (EMS)',
  0x0E: 'Large Animation (EMS)',
  0x0F: 'Small Animation (EMS)',
  0x10: 'Large Picture (EMS)',
  0x11: 'Small Picture (EMS)',
  0x12: 'Variable Picture (EMS)',
  0x20: 'RFC 5322 E-Mail Header',
  0x24: 'National Language Single Shift (GSM-7 extended table)',
  0x25: 'National Language Locking Shift (GSM-7 alternate table)',
  0x70: 'SIM OTA Command (SMS-PP Data Download) — 3GPP TS 31.111 §7.1.1',
  0x71: 'SIM OTA Response — 3GPP TS 31.111 §7.1.2',
  0x7F: 'SIM Toolkit Security Headers',
};

// ── Per-category technical detail ─────────────────────────────────────────────
export const CATEGORY_DETAIL: Partial<Record<AlertCategory, {
  explanation: string;
  references:  string[];
}>> = {
  silent_sms: {
    explanation: `A Type-0 silent SMS was received. PID byte 0x40 (per 3GPP TS 23.040 §9.2.3.9) instructs the handset to process and immediately discard the message without any user notification, alert, or storage. The subsequent delivery receipt confirms that the device is powered on and camped on a cell. This triggers a TMSI update at the serving MSC, which can be used for covert subscriber location tracking by correlating the delivery receipt timestamp with the MSC/VLR serving the subscriber.`,
    references: [
      '3GPP TS 23.040 §9.2.3.9',
      'https://srlabs.de/bites/snoopy/',
      'GSM-SEC-01 Lawful Intercept via silent SMS',
    ],
  },
  ota_command: {
    explanation: `A SIM Over-The-Air command was received via the SMS-PP mechanism (3GPP TS 31.111). UDH IEI 0x70 marks this as a SIM Data Download — the ME passes the entire SMS payload directly to the SIM card without user interaction. The SIM processes it as an APDU command.\n\nProperly authenticated OTA commands use a Key & Algorithm (KIC/KID bytes in the SIM Service Table), but unauthenticated or weakly-keyed OTA can:\n• Install new SIM applets (JavaCard applets)\n• Read/write EF files (e.g., EF_IMSI, EF_SMSP, EF_LOCI)\n• Trigger proactive commands via the installed applet\n• Exfiltrate data via MO SMS response using IEI 0x71\n\nSimJacker (2019) used this mechanism to deliver STK commands silently via OTA.`,
    references: [
      '3GPP TS 31.111 §7',
      'GSMA TS02 Remote Management Technical Specification',
      'https://simjacker.com/',
      'ETSI TS 102.225 Secured Packet Structure for UICC',
    ],
  },
  stk_proactive: {
    explanation: `A SIM Toolkit proactive command was detected in the PDU. Tag D0 (hex) is the PROACTIVE COMMAND BER-TLV tag defined in ETSI TS 102.223. Proactive commands are issued by the SIM card to the ME to perform network operations:\n• 0x13 SEND SHORT MESSAGE — proxy SMS from SIM without user consent\n• 0x15 LAUNCH BROWSER — navigate to a URL (WIBAttack/SimJacker)\n• 0x10 SETUP CALL — initiate outgoing call\n• 0x11 SEND USSD — triggers USSD string (can set call forwarding)\n• 0x23 GET INPUT — prompt user for text input (phishing)\n\nThe command type byte immediately follows D0 and the length TLV. ETSI TS 102.223 Table 11.10 contains the full command code list.`,
    references: [
      'ETSI TS 102.223 §6.4',
      'ETSI TS 102.223 Table 11.10',
      'https://wib.com.br/WIBAttack_en.pdf',
      'https://simjacker.com/',
    ],
  },
  wap_push: {
    explanation: `A WAP Push message was received. WAP Push uses the WSP PUSH PDU on UDP port 2948, delivered via binary SMS (DCS=0x04, UDH IEI 0x05 with destination port 2948). The payload is WBXML-encoded.\n\nOMA Client Provisioning (OMA-CP) via WAP Push can silently reconfigure:\n• Mobile data APN settings\n• MMS proxy/MMSC address\n• Email server settings\n• Browser home page and bookmarks\n\nOMA DM Bootstrap can enrol the device into a management server. Related: CVE-2019-16257 / CVE-2018-14953.`,
    references: [
      'OMA-TS-WAP-Push-PushOTA-V2_2',
      'WAP-251-PushMessage',
      'OMACP security issues — RedNaga Labs 2019',
      'CVE-2019-16257',
    ],
  },
  map_sri_sm: {
    explanation: `SS7 MAP Send Routing Information for Short Message (SRI-SM) observed. This operation (opCode 0x45) is issued to the HLR to retrieve the IMSI and serving MSC/SGSN for a given MSISDN before SMS delivery. Under normal operation only the home SMSC initiates SRI-SM.\n\nFrom rogue SS7 nodes, SRI-SM is used to:\n• Harvest IMSI from MSISDN (identity correlation)\n• Identify serving MSC (locate to MSC coverage area)\n\nThe GSMA FS.11 and GSMA TS08 documents classify this as Category 1 SS7 threat.`,
    references: [
      '3GPP TS 29.002 §7.6.8.1',
      'GSMA FS.11 SS7 Vulnerability Assessment',
      'GSMA TS08 SS7 Security',
    ],
  },
  map_ati: {
    explanation: `SS7 MAP Any-Time Interrogation (ATI, opCode 0x46) detected. ATI is a MAP query to the HLR/HSS that returns:\n• Current Cell Global Identity (CGI: MCC+MNC+LAC+CellID)\n• Serving VMSC/SGSN address\n• Subscriber state (busy/idle/absent)\n\nPer 3GPP TS 29.002 §7.6.3, ATI is restricted to authorised nodes. From unauthorised SCCP nodes it constitutes a real-time location tracking attack. Documented in multiple SS7 penetration testing toolkits and GSMA advisories.`,
    references: [
      '3GPP TS 29.002 §7.6.3',
      '3GPP TS 23.018',
      'GSMA FS.11 Category 2 Threat — Location Tracking via ATI',
    ],
  },
  map_isd: {
    explanation: `SS7 MAP Insert Subscriber Data (ISD, opCode 0x07) observed. The HLR/HSS uses ISD to push subscriber profile updates to VLR/SGSN after location update. Malicious use from rogue nodes can overwrite:\n• CallForwardingInfo: redirect all calls to an attacker-controlled MSISDN\n• CAMEL subscription info (O-CSI/T-CSI): insert malicious trigger point\n• GPRS subscription data: change APN or PDP context parameters\n\nISD-based call interception via call forwarding injection is classified as Category 3 SS7 threat in GSMA FS.11.`,
    references: [
      '3GPP TS 29.002 §7.6.2',
      'GSMA FS.11 Category 3',
    ],
  },
  pegasus_indicator: {
    explanation: `A byte sequence matching a documented Pegasus (NSO Group) indicator was detected. Pegasus is a fully-featured mobile surveillance implant documented by:\n• Citizen Lab (2016, 2018, 2021, 2022) — network traffic + filesystem IOCs\n• Amnesty International Tech (2021) — Forensic Methodology Report\n\nIndicators include specific domain naming patterns, base64-encoded configuration strings, and native library function name patterns. A pattern match does NOT confirm active infection — it indicates further device forensics is warranted:\n• Run MVT (Mobile Verification Toolkit) offline forensic scan\n• Extract syslog and check for process injection indicators\n• Check /data/local/tmp for unexpected binaries`,
    references: [
      'https://www.amnesty.org/en/latest/research/2021/07/forensic-methodology-report-how-to-catch-nso-groups-pegasus/',
      'https://citizenlab.ca/2018/09/hide-and-seek-tracking-nso-groups-pegasus-spyware-to-operations-in-45-countries/',
      'https://github.com/mvt-project/mvt',
    ],
  },
  scanner_hit: {
    explanation: `A byte pattern from the FieldGuard signature database was matched in a scanned file or received PDU. The scanner uses a masked sliding-window pattern match against all loaded signatures. Coloured bytes in the Hex Dump tab show the exact matching region.\n\nCheck the Matched Signature field for the signature ID. Cross-reference with the signature description to understand what protocol feature or threat it represents.`,
    references: [],
  },
  imsi_catcher: {
    explanation: `A potential IMSI catcher / rogue BTS indicator was detected. Indicators include:\n• Forced downgrade from LTE/UMTS to GSM (2G) without user action\n• Unusually strong signal from unknown Cell-ID not previously seen\n• Timing Advance (TA) inconsistency relative to known cell distance\n• Cipher mode indicator showing A5/0 (no encryption) when on 2G\n• Multiple TMSI reallocations in a short period\n\nIMSI catchers (Stingray devices) operate as fake base stations to capture IMSI and intercept traffic.`,
    references: [
      '3GPP TS 43.020 — Security related network functions (A5 ciphering)',
      '3GPP TS 24.008 — MM/CC/SM signalling',
      'https://wiki.sysmocom.de/OsmocomBB/IMSI_Catcher_Catcher',
    ],
  },
  flash_sms: {
    explanation: `A Class-0 (flash) SMS was received. DCS=0x10 instructs the ME to display the message immediately on screen without user action and without storing it.\n\nThreat: used for UI spoofing and social engineering — the popup appears instantly and is not recorded in the message inbox, making it useful for:\n• Fake operator security alerts requesting OTP codes\n• SIM swap social engineering targeting customer service representatives\n• Fake PIN prompt overlays`,
    references: [
      '3GPP TS 23.038 §4 — Message Classes',
      '3GPP TS 23.040 §9.2.3.10 — TP-Data-Coding-Scheme',
    ],
  },
};
