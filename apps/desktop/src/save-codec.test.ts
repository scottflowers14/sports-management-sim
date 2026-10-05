import { describe, expect, it } from 'vitest';
import { COMPRESSED_SAVE_PREFIX, compressText, decodeSave, decompressText, encodeSave } from './save-codec';

describe('save codec', () => {
  it('round-trips empty, short and repetitive text', () => {
    for (const text of ['', 'a', 'aa', 'aaa', 'abababababab', 'abcabcabcabcabc', '{"a":1,"a":1,"a":1}']) {
      expect(decompressText(compressText(text))).toBe(text);
    }
  });

  it('round-trips non-ASCII text, including emoji surrogate pairs', () => {
    const text = 'Café «Coach» 🥍 — 年 '.repeat(50);
    expect(decompressText(compressText(text))).toBe(text);
  });

  it('round-trips pseudo-random text with a growing dictionary', () => {
    let seed = 7;
    const chars: string[] = [];
    for (let i = 0; i < 60000; i += 1) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      chars.push(String.fromCharCode(32 + (seed % 90)));
    }
    const text = chars.join('');
    expect(decompressText(compressText(text))).toBe(text);
  });

  it('keeps every output character out of the surrogate range', () => {
    const out = compressText('{"id":"player-1","overall":72}'.repeat(500));
    for (let i = 0; i < out.length; i += 1) {
      const code = out.charCodeAt(i);
      expect(code < 0xd800 || code > 0xdfff).toBe(true);
    }
  });

  it('shrinks JSON-like text several times over', () => {
    const rows = Array.from({ length: 2000 }, (_, i) => ({ id: `player-${i}`, position: 'MID', overall: 60 + (i % 20), class: 'SO' }));
    const json = JSON.stringify(rows);
    expect(compressText(json).length).toBeLessThan(json.length / 4);
  });

  it('marks encoded saves and passes raw JSON from older builds through', () => {
    const json = '{"version":1}';
    expect(encodeSave(json).startsWith(COMPRESSED_SAVE_PREFIX)).toBe(true);
    expect(decodeSave(encodeSave(json))).toBe(json);
    expect(decodeSave(json)).toBe(json);
  });

  it('throws on a truncated stream instead of returning garbage', () => {
    const packed = compressText('{"version":1,"name":"Capital City 2031"}'.repeat(20));
    expect(() => decompressText(packed.slice(0, packed.length - 5))).toThrow();
  });
});
