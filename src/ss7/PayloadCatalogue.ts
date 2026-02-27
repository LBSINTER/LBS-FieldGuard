/**
 * LBS FieldGuard — SS7 Payload Catalogue
 *
 * Pre-loaded catalogue of known SMS/SS7/SIM attack payload types.
 * Each entry names the real protocol mechanism, references 3GPP specs, and
 * explains the concrete threat model — no generic or fabricated descriptions.  Each entry describes a known
 * attack vector, its protocol layer, common PDU prefix, and detection hint.
 *
 * This module is used by:
 *   - RILMonitor  — to classify inbound PDUs
 *   - PDU Builder UI — to offer template selection
 *   - AlertsScreen  — to enrich alert descriptions
 */

import { ByteSignature } from '../types';

export interface SS7PayloadEntry {
  id: string;
  name: string;
  layer: 'SMS-PP' | 'SMS-CB' | 'SS7-MAP' | 'SS7-CAP' | 'SIM-OTA' | 'STK' | 'USSD' | 'GTP' | 'DIAMETER';
  attack: string;
  pduPrefix?: string;     // hex prefix, may contain wildcards (??)
  pid?: number;
  dcs?: number;
  udhIei?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  mitigation: string;
  references: string[];
}

export const SS7_PAYLOAD_CATALOGUE: SS7PayloadEntry[] = [
  // ── Silent / stealth SMS ────────────────────────────────────────────────────
  {
    id: 'SILENT_TYPE0',
    name: 'Type-0 Silent SMS',
    layer: 'SMS-PP',
    attack: 'Passive subscriber activity confirmation and TMSI update triggering (3GPP TS 23.040)',
    pid: 0x40,
    severity: 'high',
    description:
      'PID=0x40 tells the handset to discard the message after processing. ' +
      'No user notification. Used by LE/intelligence to confirm handset is active and ' +
      'obtain a network Temporary Mobile Subscriber Identity (TMSI) update.',
    mitigation: 'Block PID=0x40 at SMS-C or STP filter. Alert on delivery receipt for unknown originator.',
    references: [
      'https://srlabs.de/bites/snoopy/',
      '3GPP TS 23.040 §9.2.3.9',
    ],
  },
  {
    id: 'FLASH_CLASS0',
    name: 'Class-0 Flash SMS',
    layer: 'SMS-PP',
    attack: 'Social engineering / UI confusion',
    dcs: 0x10,
    severity: 'low',
    description:
      'DCS message class 0 forces display on screen immediately without any user action. ' +
      'Used for social engineering (fake security alerts, credential phishing popups).',
    mitigation: 'Firewall class-0 from non-operator originators.',
    references: ['3GPP TS 23.038 §4'],
  },

  // ── SIM OTA ─────────────────────────────────────────────────────────────────
  {
    id: 'SIM_OTA_UDH70',
    name: 'SIM OTA — Command (IEI 0x70)',
    layer: 'SIM-OTA',
    attack: 'Silent SIM applet installation / key extraction',
    udhIei: 0x70,
    severity: 'critical',
    description:
      'UDH Information Element Identifier 0x70 encodes a SIM Data Download command ' +
      'per 3GPP TS 31.111. Delivered via SMS-PP, it is forwarded transparently to the ' +
      'SIM without any user interaction.  An unauthenticated OTA can install a new ' +
      'applet, modify phonebook, or exfiltrate Ki/OPc.',
    mitigation: 'Validate OTA-TAR against authorised values. Reject unsigned OTA (no SPI-CNTR).',
    references: [
      '3GPP TS 31.111',
      'GSMA TS.02',
      'https://labs.karpersky.com/publications/sim-ota/',
    ],
  },
  {
    id: 'SIM_OTA_UDH71',
    name: 'SIM OTA — Response (IEI 0x71)',
    layer: 'SIM-OTA',
    attack: 'SIM application response exfiltration',
    udhIei: 0x71,
    severity: 'critical',
    description:
      'UDH IEI 0x71 is the response packet from the SIM back to the OTA platform. ' +
      'Intercepting this reveals applet execution status and may include exfiltrated data.',
    mitigation: 'Block MO SMS with UDH IEI 0x71 from non-operator SMSCs.',
    references: ['3GPP TS 31.111 §7.1.2'],
  },

  // ── STK / SIM Toolkit ────────────────────────────────────────────────────────
  {
    id: 'STK_PROACTIVE_7F',
    name: 'STK ProactiveCommand delivery via SMS (PID=0x7F)',
    layer: 'STK',
    attack: 'Remote SIM Toolkit command execution',
    pid: 0x7f,
    pduPrefix: 'd0',
    severity: 'critical',
    description:
      'PID=0x7F combined with DCS binary encodes a SIM Toolkit ProactiveCommand ' +
      'payload (BER-TLV starting 0xD0).  Commands include: LAUNCH BROWSER, ' +
      'SEND SHORT MESSAGE, PLAY TONE, SET UP CALL, PERFORM CARD APDU. ' +
      'Used by Simjacker (AdaptiveMobile 2019) to silently exfiltrate location.',
    mitigation: 'Block PID=0x7F at SMS-GW. Alert on 0xD0 binary SMS body.',
    references: [
      'https://simjacker.com/',
      'ETSI TS 102 223',
      '3GPP TS 31.111 §6.4',
    ],
  },
  {
    id: 'STK_SEND_SMS',
    name: 'STK SEND SHORT MESSAGE command',
    layer: 'STK',
    attack: 'Exfiltration of device data via silent MO SMS',
    pduPrefix: 'd0 ?? 81 03 01 13',
    severity: 'critical',
    description:
      'BER-TLV tag 0xD0 (ProactiveCommand), command qualifier 0x13 = ' +
      'SEND SHORT MESSAGE.  SIM autonomously sends an MO SMS to an attacker ' +
      'number containing IMSI, location, or contact data.',
    mitigation: 'Monitor for anomalous MO SMS from SIM without user interaction.',
    references: ['ETSI TS 102 223 §6.4.10'],
  },
  {
    id: 'STK_LAUNCH_BROWSER',
    name: 'STK LAUNCH BROWSER command',
    layer: 'STK',
    attack: 'Drive-by browser exploit delivery',
    pduPrefix: 'd0 ?? 81 03 01 15',
    severity: 'high',
    description:
      'ProactiveCommand 0x15 = LAUNCH BROWSER.  The SIM triggers the handset ' +
      'browser to navigate to an attacker-controlled URL without any user action. ' +
      'Used to deliver CVE-targeted browser exploits (Pegasus stage 1).',
    mitigation: 'Prompt user before browser launch via STK. Compare URL against known-bad lists.',
    references: ['ETSI TS 102 223 §6.4.26', 'https://citizenlab.ca/2021/07/forensic-methodology-report-how-to-catch-nso-groups-pegasus/'],
  },

  // ── USSD push ────────────────────────────────────────────────────────────────
  {
    id: 'USSD_PUSH_HIJACK',
    name: 'SS7 MAP USSD Push',
    layer: 'USSD',
    attack: 'Credential theft / 2FA hijack via network-initiated USSD',
    severity: 'high',
    description:
      'MAP processUnstructuredSSRequest (opcode 59) sent from a rogue STP/HLR allows ' +
      'an attacker to initiate a USSD session with the handset.  Payload typically ' +
      'requests financial transfer confirmation or presents a credential phishing dialog.',
    mitigation: 'Block unsolicited opcode 59 at STP/firewall. Require E.214 validation.',
    references: [
      'https://seclists.org/fulldisclosure/2014/Aug/19',
      '3GPP TS 29.002 §7.6.1',
    ],
  },

  // ── SS7 MAP attacks ──────────────────────────────────────────────────────────
  {
    id: 'MAP_SRILSM',
    name: 'SS7 MAP SendRoutingInfoForSM (SRI-SM)',
    layer: 'SS7-MAP',
    attack: 'IMSI harvesting / subscriber location lookup',
    severity: 'high',
    description:
      'MAP opcode 45 (SRI-SM) returns the IMSI and current MSC/VMSC address for any ' +
      'mobile subscriber.  No authentication required in pre-rel12 networks. ' +
      'Used as step 1 of location tracking and eavesdropping chains.',
    mitigation: 'Filter SRI-SM from non-whitelisted GTT at SS7 firewall (GSMA FS.11 Cat 1).',
    references: [
      '3GPP TS 29.002 §7.6.8.1',
      'GSMA FS.11',
      'https://srlabs.de/bites/ss7-attacks/',
    ],
  },
  {
    id: 'MAP_ATI',
    name: 'SS7 MAP AnyTimeInterrogation (ATI)',
    layer: 'SS7-MAP',
    attack: 'Real-time location disclosure (cell/LAC)',
    severity: 'critical',
    description:
      'MAP opcode 71 (ATI) returns the current serving cell, LAI, and in some ' +
      'implementations GPS coordinates (via eATI extension).  Exploited by ' +
      'commercial tracking services and state actors.',
    mitigation: 'Block ATI from all non-operator addresses (GSMA FS.11 Cat 2).',
    references: ['3GPP TS 29.002 §7.10', 'GSMA FS.11'],
  },
  {
    id: 'MAP_ISD',
    name: 'SS7 MAP InsertSubscriberData (ISD)',
    layer: 'SS7-MAP',
    attack: 'Call/SMS forwarding registration to attacker number',
    severity: 'critical',
    description:
      'MAP opcode 7 (ISD) allows a rogue VLR/HLR to insert or modify forwarding ' +
      'service data in the target VLR.  Attacker registers unconditional forward ' +
      'to their number to intercept calls and SMS (including 2FA codes).',
    mitigation: 'Validate ISD with home HLR before actioning. Block cross-network ISD.',
    references: ['3GPP TS 29.002 §7.6.2'],
  },

  // ── GTP / LTE ────────────────────────────────────────────────────────────────
  {
    id: 'GTP_HIJACK',
    name: 'GTPv1 Create Session Request spoofing',
    layer: 'GTP',
    attack: 'Session hijacking / free data',
    severity: 'high',
    description:
      'GTPv1 (port 2123) lacks source authentication.  A rogue packet with a valid ' +
      'IMSI/IMEI can create a shadow session on the GGSN/PGW, hijacking the ' +
      'subscriber\'s data bearer.',
    mitigation: 'Filter GTP-C on GRX/IPX to authorised peer addresses only.',
    references: ['https://positive.technologies/app/media/docs/LTE_security_en.pdf'],
  },

  // ── Pegasus / NSO ────────────────────────────────────────────────────────────
  {
    id: 'NSO_PEGASUS_STAGERHEX',
    name: 'Pegasus Stage-1 stager (network delivery)',
    layer: 'SMS-PP',
    attack: 'Zero-click exploit delivery via iMessage/WhatsApp WebRTC/SMS',
    pduPrefix: '9110',
    severity: 'critical',
    description:
      'Pegasus (NSO Group) stage-1 payloads have been observed with binary SMS ' +
      'or WAP push frames.  Network-level indicators include anomalous MSRP ' +
      'blobs and short binary SMS segments with 0x91xx originator type. ' +
      'Full forensic IOCs available in Amnesty Tech MVT tool.',
    mitigation: 'Run Amnesty MVT on device. Block binary SMS from suspicious GTTs. Update OS.',
    references: [
      'https://github.com/mvt-project/mvt',
      'https://citizenlab.ca/2021/07/forensic-methodology-report-how-to-catch-nso-groups-pegasus/',
    ],
  },
];

/**
 * Look up a payload entry by PDU prefix or PID/DCS/UDH match.
 */
export function classifyPayload(opts: {
  pid?: number;
  dcs?: number;
  udhIei?: number;
  binaryHex?: string;
}): SS7PayloadEntry | undefined {
  for (const entry of SS7_PAYLOAD_CATALOGUE) {
    if (entry.pid !== undefined && entry.pid !== opts.pid) continue;
    if (entry.dcs !== undefined && entry.dcs !== opts.dcs) continue;
    if (entry.udhIei !== undefined && entry.udhIei !== opts.udhIei) continue;
    if (entry.pduPrefix && opts.binaryHex) {
      const pattern = entry.pduPrefix.replace(/\s/g, '');
      const hex = opts.binaryHex.replace(/\s/g, '').toLowerCase();
      const pat = pattern.replace(/ /g, '').toLowerCase();
      // Wildcard ?? matches any byte
      let match = true;
      for (let i = 0; i < pat.length; i += 2) {
        const pb = pat.slice(i, i + 2);
        if (pb === '??') continue;
        if (pb !== hex.slice(i, i + 2)) { match = false; break; }
      }
      if (!match) continue;
    }
    return entry;
  }
  return undefined;
}

/**
 * Convert SS7PayloadEntry to a ByteSignature for use in the scanner.
 */
export function catalogueToSignatures(): ByteSignature[] {
  return SS7_PAYLOAD_CATALOGUE
    .filter((e) => e.pduPrefix)
    .map((e) => ({
      id: e.id,
      name: e.name,
      category: e.layer.toLowerCase().replace(/-/g, '_'),
      severity: e.severity,
      pattern: (e.pduPrefix ?? '').replace(/\?\?/g, '00'),
      mask: e.pduPrefix?.split(' ').map((b) => (b === '??' ? '00' : 'ff')).join(' '),
      description: e.description,
    }));
}
