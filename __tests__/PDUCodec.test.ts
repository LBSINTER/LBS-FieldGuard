/**
 * LBS FieldGuard — PDUCodec tests
 */

import { encodePDU, decodePDU } from '../src/android/PDUCodec';

describe('PDUCodec', () => {
  test('encode + decode round-trip (GSM-7 text)', () => {
    const pdu = encodePDU({ to: '+12025550123', text: 'Hello LBS' });
    expect(pdu).toBeTruthy();
    const dec = decodePDU(pdu);
    expect(dec.text?.trim()).toBe('Hello LBS');
    expect(dec.dcsEncoding).toBe('gsm7');
  });

  test('encode binary PID=0x40 (Type-0 silent SMS)', () => {
    const pdu = encodePDU({
      to: '+441234567890',
      text: ' ',
      pid: 0x40,
      dcs: 0x00,
    });
    const dec = decodePDU(pdu);
    expect(dec.pid).toBe(0x40);
  });

  test('encode STK ProactiveCommand binary (PID=0x7F)', () => {
    const payload = Buffer.from('d01281030115008202818233050101', 'hex');
    const pdu = encodePDU({
      to: '+441234567890',
      binary: payload,
      pid: 0x7f,
      dcs: 0x04,
    });
    const dec = decodePDU(pdu);
    expect(dec.pid).toBe(0x7f);
    expect(dec.dcsEncoding).toBe('binary');
    expect(dec.binaryPayload?.toLowerCase()).toContain('d012');
  });

  test('decode known TD-PDU sample', () => {
    // SMS-DELIVER: +1999 → "Test", GSM-7, no SMSC prefix
    // 00 04 0B 91 51 09 99 99 F9 00 00 11 21 31 14 00 00 04 D4 F2 9C 0E
    const hex = '000B9151099999F9000011213114000004D4F29C0E';
    // This particular PDU has 00 SMSC, so decode should not throw
    expect(() => decodePDU(hex)).not.toThrow();
  });
});
