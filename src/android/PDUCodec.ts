/**
 * LBS FieldGuard — PDU Codec
 *
 * Encodes and decodes 3GPP TS 23.040 SMS PDUs (SMS-DELIVER and SMS-SUBMIT).
 *
 * Supports:
 *   - GSM 7-bit default alphabet (DCS 0x00)
 *   - UCS-2 (DCS 0x08)
 *   - Binary (DCS 0x04)
 *   - Type-0 silent SMS (PID 0x40)
 *   - SIM OTA UDH detection (IEI 0x70 / 0x71)
 *   - STK ProactiveCommand detection (PID 0x7F)
 *   - Full UDH parsing
 *
 * All multi-byte values are big-endian unless noted.
 * BCD semi-octets are used for SMSC and address fields (reversed nibbles).
 */

import { PDUDecoded, UDHHeader } from '../types';

// ── GSM-7 character table (standard) ─────────────────────────────────────────
const GSM7 =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1bÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ`¿abcdefghijklmnopqrstuvwxyzäöñüà';

function gsm7Decode(bytes: Uint8Array, charCount: number): string {
  let bits = 0;
  let val = 0;
  let result = '';
  for (const byte of bytes) {
    val |= byte << bits;
    bits += 8;
    while (bits >= 7 && result.length < charCount) {
      result += GSM7[val & 0x7f] ?? '?';
      val >>= 7;
      bits -= 7;
    }
  }
  return result;
}

function gsm7Encode(text: string): Uint8Array {
  const septets: number[] = [];
  for (const ch of text) {
    const idx = GSM7.indexOf(ch);
    septets.push(idx >= 0 ? idx : 0x3f); // '?' for unmapped
  }
  const byteCount = Math.ceil((septets.length * 7) / 8);
  const out = new Uint8Array(byteCount);
  let bits = 0;
  let val = 0;
  let bIdx = 0;
  for (const s of septets) {
    val |= (s & 0x7f) << bits;
    bits += 7;
    while (bits >= 8) {
      out[bIdx++] = val & 0xff;
      val >>= 8;
      bits -= 8;
    }
  }
  if (bits > 0) out[bIdx] = val & 0xff;
  return out;
}

// ── BCD / semi-octet helpers ───────────────────────────────────────────────────
function bcdDecode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) {
    const lo = b & 0x0f;
    const hi = (b >> 4) & 0x0f;
    if (lo !== 0x0f) s += lo.toString(16);
    if (hi !== 0x0f) s += hi.toString(16);
  }
  return s;
}

function bcdEncode(num: string): Uint8Array {
  // Pad to even length
  const padded = num.length % 2 === 0 ? num : num + 'F';
  const out = new Uint8Array(padded.length / 2);
  for (let i = 0; i < padded.length; i += 2) {
    const lo = parseInt(padded[i]!, 16);
    const hi = parseInt(padded[i + 1]!, 16);
    out[i / 2] = lo | (hi << 4);
  }
  return out;
}

// ── Hex helpers ───────────────────────────────────────────────────────────────
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s/g, '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    out[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ')
    .toUpperCase();
}

// ── UDH parser ────────────────────────────────────────────────────────────────
function parseUDH(ud: Uint8Array): { headers: UDHHeader[]; bodyStart: number } {
  const udhLen = ud[0]!;
  const headers: UDHHeader[] = [];
  let i = 1;
  while (i < udhLen + 1) {
    const iei = ud[i++]!;
    const len = ud[i++]!;
    const data = bytesToHex(ud.slice(i, i + len)).replace(/ /g, '');
    headers.push({ iei, data });
    i += len;
  }
  return { headers, bodyStart: udhLen + 1 };
}

// ── Decode (SMS-DELIVER) ───────────────────────────────────────────────────────
export function decodePDU(hex: string): PDUDecoded {
  const bytes = hexToBytes(hex);
  let pos = 0;

  // SMSC length
  const smscLen = bytes[pos++]!;
  let smsc = '';
  let smscType = 0;
  if (smscLen > 0) {
    smscType = bytes[pos++]!;
    smsc = bcdDecode(bytes.slice(pos, pos + smscLen - 1));
    pos += smscLen - 1;
  }

  // First octet (TP-MTI etc.)
  const fo = bytes[pos++]!;
  const tpMti = fo & 0x03;
  const tpMms = !!(fo & 0x04);
  const tpSri = !!(fo & 0x20);
  const tpUdhi = !!(fo & 0x40);

  // Originating address (sender)
  const oaLen = bytes[pos++]!; // length in semi-octets
  const oaTon = (bytes[pos++]! >> 4) & 0x07;
  const oaBytes = Math.ceil(oaLen / 2);
  const sender = bcdDecode(bytes.slice(pos, pos + oaBytes)).slice(0, oaLen);
  pos += oaBytes;

  // PID, DCS
  const pid = bytes[pos++]!;
  const dcs = bytes[pos++]!;

  // SCTS timestamp
  const tsBytes = bytes.slice(pos, pos + 7);
  const timestamp = _decodeTimestamp(tsBytes);
  pos += 7;

  // UD length
  const udLen = bytes[pos++]!;
  const udRaw = bytes.slice(pos);

  let text: string | undefined;
  let binaryPayload: string | undefined;
  let udh: UDHHeader[] | undefined;

  const dcsEncoding: PDUDecoded['dcsEncoding'] =
    (dcs & 0x0c) === 0x00 ? 'gsm7' :
    (dcs & 0x0c) === 0x04 ? 'binary' :
    (dcs & 0x0c) === 0x08 ? 'ucs2' : 'unknown';

  let bodyStart = 0;
  if (tpUdhi) {
    const { headers, bodyStart: bs } = parseUDH(udRaw);
    udh = headers;
    bodyStart = bs;
  }

  if (dcsEncoding === 'gsm7') {
    text = gsm7Decode(udRaw.slice(bodyStart), udLen);
  } else if (dcsEncoding === 'ucs2') {
    const body = udRaw.slice(bodyStart);
    text = new TextDecoder('utf-16be').decode(body);
  } else {
    binaryPayload = bytesToHex(udRaw.slice(bodyStart)).replace(/ /g, '');
  }

  return {
    smsc,
    smscType,
    tpMti,
    tpMms,
    tpSri,
    tpUdhi,
    sender,
    senderType: oaTon,
    pid,
    dcs,
    dcsEncoding,
    timestamp,
    udLen,
    udh,
    text,
    binaryPayload,
  };
}

function _decodeTimestamp(b: Uint8Array): string {
  const n = (x: number) => (((x & 0x0f) * 10 + ((x >> 4) & 0x0f)));
  const yr = 2000 + n(b[0]!);
  const mo = n(b[1]!);
  const dy = n(b[2]!);
  const hr = n(b[3]!);
  const mn = n(b[4]!);
  const sc = n(b[5]!);
  return `${yr}-${String(mo).padStart(2,'0')}-${String(dy).padStart(2,'0')} ` +
         `${String(hr).padStart(2,'0')}:${String(mn).padStart(2,'0')}:${String(sc).padStart(2,'0')}`;
}

// ── Encode (SMS-SUBMIT) ────────────────────────────────────────────────────────
export interface EncodeOptions {
  to: string;
  text?: string;
  binary?: Uint8Array;
  pid?: number;       // default 0x00 — set 0x40 for Type-0 silent
  dcs?: number;       // default 0x00 GSM7; 0x04 binary; 0x08 UCS2
  udh?: UDHHeader[];
}

export function encodePDU(opts: EncodeOptions): string {
  const parts: number[] = [];

  // SMSC (empty — use default from SIM)
  parts.push(0x00);

  // TP-MTI=01 (SMS-SUBMIT), TP-VPF=10 (relative VP)
  const tpUdhi = opts.udh && opts.udh.length > 0;
  parts.push(tpUdhi ? 0x41 : 0x01);

  // TP-MR (message reference)
  parts.push(0x00);

  // TP-DA (destination address)
  const toDigits = opts.to.replace(/\D/g, '');
  const toType = opts.to.startsWith('+') ? 0x91 : 0x81;
  parts.push(toDigits.length);
  parts.push(toType);
  const encTo = bcdEncode(toDigits);
  for (const b of encTo) parts.push(b);

  // PID, DCS
  const pid = opts.pid ?? 0x00;
  const dcs = opts.dcs ?? (opts.binary ? 0x04 : 0x00);
  parts.push(pid);
  parts.push(dcs);

  // TP-VP (relative, 1 week = 0xa7)
  parts.push(0xa7);

  // Build UD
  let udhBytes: number[] = [];
  if (tpUdhi && opts.udh) {
    const udhPayload: number[] = [];
    for (const h of opts.udh) {
      const data = hexToBytes(h.data);
      udhPayload.push(h.iei, data.length, ...data);
    }
    udhBytes = [udhPayload.length, ...udhPayload];
  }

  let udBody: Uint8Array;
  if (opts.binary) {
    udBody = opts.binary;
  } else {
    udBody = gsm7Encode(opts.text ?? '');
  }

  const ud = new Uint8Array(udhBytes.length + udBody.length);
  ud.set(udhBytes, 0);
  ud.set(udBody, udhBytes.length);

  // UD length (in septets for GSM7, in bytes otherwise)
  const udLen = dcs === 0x00
    ? (opts.text?.length ?? 0) + (tpUdhi ? Math.ceil((udhBytes.length * 8) / 7) : 0)
    : ud.length;

  parts.push(udLen);
  for (const b of ud) parts.push(b);

  return parts.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}
