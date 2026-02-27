/**
 * LBS FieldGuard — SignatureDB tests
 */

import { loadSignatures, getSignatures, matchSignatures } from '../src/scanner/SignatureDB';

describe('SignatureDB', () => {
  beforeAll(async () => {
    await loadSignatures();
  });

  test('loads signatures from bundled DB', () => {
    const sigs = getSignatures();
    expect(sigs.length).toBeGreaterThan(0);
  });

  test('matches STK D0 prefix', () => {
    const data = Buffer.from('d01281030115008202818233050101', 'hex');
    const matches = matchSignatures(data);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m) => m.sig.id.startsWith('STK_'))).toBe(true);
  });

  test('no false positive on clean buffer', () => {
    const data = Buffer.from('48656c6c6f20576f726c64', 'hex'); // "Hello World"
    const matches = matchSignatures(data);
    expect(matches.length).toBe(0);
  });

  test('matches MAP SRI-SM opcode', () => {
    const data = Buffer.from('02012d0101', 'hex');
    const matches = matchSignatures(data);
    expect(matches.some((m) => m.sig.id === 'MAP_SRI_SM')).toBe(true);
  });
});
