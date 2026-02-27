/**
 * LBS FieldGuard — SS7 PayloadCatalogue tests
 */

import { classifyPayload, SS7_PAYLOAD_CATALOGUE } from '../src/ss7/PayloadCatalogue';

describe('PayloadCatalogue', () => {
  test('catalogue has entries', () => {
    expect(SS7_PAYLOAD_CATALOGUE.length).toBeGreaterThan(5);
  });

  test('classifies Type-0 silent SMS (PID=0x40)', () => {
    const entry = classifyPayload({ pid: 0x40 });
    expect(entry).toBeDefined();
    expect(entry?.id).toBe('SILENT_TYPE0');
    expect(entry?.severity).toBe('high');
  });

  test('classifies STK ProactiveCommand (PID=0x7F)', () => {
    const entry = classifyPayload({ pid: 0x7f });
    expect(entry).toBeDefined();
    expect(entry?.id).toBe('STK_PROACTIVE_7F');
    expect(entry?.severity).toBe('critical');
  });

  test('classifies SIM OTA IEI 0x70', () => {
    const entry = classifyPayload({ udhIei: 0x70 });
    expect(entry?.id).toBe('SIM_OTA_UDH70');
  });

  test('returns undefined for normal SMS', () => {
    const entry = classifyPayload({ pid: 0x00, dcs: 0x00 });
    expect(entry).toBeUndefined();
  });
});
