/**
 * LBS FieldGuard — Raw PDU Sender
 *
 * Interface for android.telephony.SmsManager.sendRawPdu() available on
 * rooted devices or via the SEND_RAW_PDU permission.
 *
 * Availability: Android < 10, or root access with remount and grant.
 * On Android 10+ the method is non-SDK and requires privilege escalation.
 *
 * Usage is guarded — we check at runtime whether the native module is present
 * before exposing send capability in the UI.
 */

import { NativeModules, Platform } from 'react-native';

export interface RawPDUSendResult {
  success: boolean;
  error?:  string;
  /** SMSC response where available */
  smscResponse?: string;
}

export interface RawPDUSenderModule {
  /**
   * Send a raw SMS PDU (TP-layer bytes only, no SMSC header).
   * The native module prepends the default SMSC address automatically.
   *
   * @param pduHex  Hex string of the TP-PDU bytes (no spaces, lowercase ok)
   * @param smscHex Optional hex SMSC address override; null = use SIM default
   */
  sendRawPdu(pduHex: string, smscHex: string | null): Promise<RawPDUSendResult>;

  /**
   * Returns true if the platform exposes a (possibly privileged) path to
   * SmsManager.sendRawPdu or equivalent.
   */
  isRawPduAvailable(): Promise<boolean>;

  /**
   * Return the SIM slot count for dual-SIM devices.
   */
  getSimSlotCount(): Promise<number>;
}

const { FieldGuardRawPDU } = NativeModules;

class RawPDUSenderImpl implements RawPDUSenderModule {
  private readonly _available: boolean;

  constructor() {
    this._available = Platform.OS === 'android' && !!FieldGuardRawPDU;
  }

  async isRawPduAvailable(): Promise<boolean> {
    if (!this._available) return false;
    try {
      return await FieldGuardRawPDU.isRawPduAvailable();
    } catch {
      return false;
    }
  }

  async sendRawPdu(pduHex: string, smscHex: string | null): Promise<RawPDUSendResult> {
    if (!this._available) {
      return {
        success: false,
        error:   'FieldGuardRawPDU native module not found. Root access or privileged system app required.',
      };
    }

    // Sanitise input — strip spaces, lowercase
    const cleanPdu  = pduHex.replace(/\s+/g, '').toLowerCase();
    if (!/^[0-9a-f]+$/.test(cleanPdu) || cleanPdu.length % 2 !== 0) {
      return { success: false, error: 'Invalid hex PDU: odd length or non-hex characters' };
    }

    const cleanSmsc = smscHex
      ? smscHex.replace(/\s+/g, '').toLowerCase()
      : null;

    try {
      return await FieldGuardRawPDU.sendRawPdu(cleanPdu, cleanSmsc);
    } catch (err: any) {
      return { success: false, error: String(err?.message ?? err) };
    }
  }

  async getSimSlotCount(): Promise<number> {
    if (!this._available) return 1;
    try {
      return await FieldGuardRawPDU.getSimSlotCount();
    } catch {
      return 1;
    }
  }
}

export const RawPDUSender = new RawPDUSenderImpl();

// ── Static PDU helper utilities ───────────────────────────────────────────────

/** Convert ASCII/hex string to byte array */
export function hexToBytes(hex: string): number[] {
  const clean = hex.replace(/\s+/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.slice(i, i + 2), 16));
  }
  return bytes;
}

/** Convert byte array to hex string */
export function bytesToHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Encode GSM-7 string to packed septets (returns hex string) */
export function encodeGsm7(text: string): string {
  const GSM7 = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1bÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ`¿abcdefghijklmnopqrstuvwxyzäöñüà';
  const bits: number[] = [];
  for (const ch of text) {
    const idx = GSM7.indexOf(ch);
    const code = idx === -1 ? 0x3F : idx; // fallback to '?'
    for (let b = 0; b < 7; b++) bits.push((code >> b) & 1);
  }
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8 && i + b < bits.length; b++) byte |= bits[i + b] << b;
    bytes.push(byte);
  }
  return bytesToHex(bytes);
}
