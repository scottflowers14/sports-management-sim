/**
 * Compact text codec for dynasty saves.
 *
 * localStorage holds about 5 M characters for the whole site, and a mature
 * dynasty is about 3.4 M characters of JSON, so two saves didn't fit. Saves
 * are mostly repeated keys and ids, which LZW shrinks several times over.
 *
 * Codes are written with a width that grows with the dictionary and packed
 * 15 bits per UTF-16 character. Every output character stays well below the
 * surrogate range, so the result is a plain string localStorage can hold.
 * Code 0 introduces a new literal character (16 bits follow), code 1 ends the
 * stream, and dictionary entries start at 2.
 */

/** Prefix that marks a compressed save. Raw JSON saves start with "{". */
export const COMPRESSED_SAVE_PREFIX = '\u0001lzw1:';

const BITS_PER_CHAR = 15;
const CHAR_OFFSET = 0x20;
const LITERAL_CODE = 0;
const END_CODE = 1;
const FIRST_DICT_CODE = 2;

function bitsFor(size: number): number {
  return 32 - Math.clz32(size - 1);
}

class BitWriter {
  private codes: number[] = [];
  private buffer = 0;
  private filled = 0;

  write(value: number, width: number): void {
    let rest = width;
    while (rest > 0) {
      const take = Math.min(rest, BITS_PER_CHAR - this.filled);
      rest -= take;
      this.buffer = (this.buffer << take) | ((value >>> rest) & ((1 << take) - 1));
      this.filled += take;
      if (this.filled === BITS_PER_CHAR) {
        this.codes.push(this.buffer + CHAR_OFFSET);
        this.buffer = 0;
        this.filled = 0;
      }
    }
  }

  finish(): string {
    if (this.filled > 0) {
      this.codes.push((this.buffer << (BITS_PER_CHAR - this.filled)) + CHAR_OFFSET);
      this.buffer = 0;
      this.filled = 0;
    }
    return charCodesToString(this.codes);
  }
}

function charCodesToString(codes: number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < codes.length; i += CHUNK) {
    parts.push(String.fromCharCode(...codes.slice(i, i + CHUNK)));
  }
  return parts.join('');
}

const CHUNK = 8192;

class BitReader {
  private index = 0;
  private buffer = 0;
  private remaining = 0;

  constructor(private readonly input: string) {}

  read(width: number): number {
    let value = 0;
    for (let i = 0; i < width; i += 1) {
      if (this.remaining === 0) {
        if (this.index >= this.input.length) throw new Error('Compressed save ended early.');
        this.buffer = this.input.charCodeAt(this.index) - CHAR_OFFSET;
        this.index += 1;
        this.remaining = BITS_PER_CHAR;
      }
      this.remaining -= 1;
      value = value * 2 + ((this.buffer >>> this.remaining) & 1);
    }
    return value;
  }
}

/**
 * Dictionary of "prefix code + next char" -> code, as an open-addressing hash
 * table over typed arrays. A Map per trie node was several times slower on a
 * 3 MB save, and saves run on every autosave.
 */
class PairTable {
  private prefixes: Int32Array;
  private chars: Int32Array;
  private codes: Int32Array;
  private size = 0;
  private mask: number;

  constructor(capacity = 1 << 16) {
    this.prefixes = new Int32Array(capacity);
    this.chars = new Int32Array(capacity);
    this.codes = new Int32Array(capacity).fill(-1);
    this.mask = capacity - 1;
  }

  private slot(prefix: number, char: number): number {
    let i = (Math.imul(prefix, 0x9e3779b1) ^ Math.imul(char, 0x85ebca77)) & this.mask;
    while (this.codes[i] !== -1 && (this.prefixes[i] !== prefix || this.chars[i] !== char)) {
      i = (i + 1) & this.mask;
    }
    return i;
  }

  get(prefix: number, char: number): number {
    return this.codes[this.slot(prefix, char)]!;
  }

  /** Adds the pair unless it is already there. */
  add(prefix: number, char: number, code: number): void {
    const i = this.slot(prefix, char);
    if (this.codes[i] !== -1) return;
    this.prefixes[i] = prefix;
    this.chars[i] = char;
    this.codes[i] = code;
    this.size += 1;
    if (this.size * 2 > this.mask) this.grow();
  }

  private grow(): void {
    const { prefixes, chars, codes } = this;
    const capacity = (this.mask + 1) * 2;
    this.prefixes = new Int32Array(capacity);
    this.chars = new Int32Array(capacity);
    this.codes = new Int32Array(capacity).fill(-1);
    this.mask = capacity - 1;
    for (let i = 0; i < codes.length; i += 1) {
      if (codes[i] === -1) continue;
      const j = this.slot(prefixes[i]!, chars[i]!);
      this.prefixes[j] = prefixes[i]!;
      this.chars[j] = chars[i]!;
      this.codes[j] = codes[i]!;
    }
  }
}

/** Compress any string into the save codec's text form (without the prefix). */
export function compressText(input: string): string {
  const writer = new BitWriter();
  const singles = new Int32Array(65536).fill(-1);
  const pairs = new PairTable();
  let nextCode = FIRST_DICT_CODE;
  // The entry "previous token + first char of this token" is added when this
  // token is written, the same moment the decoder can add it.
  let previous = -1;

  const extendPrevious = (firstChar: number) => {
    if (previous === -1) return;
    pairs.add(previous, firstChar, nextCode);
    nextCode += 1;
  };

  let current = -1;
  let currentFirst = 0;
  for (let i = 0; i < input.length; i += 1) {
    const char = input.charCodeAt(i);
    if (current !== -1) {
      const next = pairs.get(current, char);
      if (next !== -1) {
        current = next;
        continue;
      }
      writer.write(current, bitsFor(nextCode));
      extendPrevious(currentFirst);
      previous = current;
      current = -1;
    }
    const single = singles[char]!;
    if (single !== -1) {
      current = single;
      currentFirst = char;
    } else {
      writer.write(LITERAL_CODE, bitsFor(nextCode));
      writer.write(char, 16);
      const code = nextCode;
      singles[char] = code;
      nextCode += 1;
      extendPrevious(char);
      previous = code;
    }
  }
  if (current !== -1) {
    writer.write(current, bitsFor(nextCode));
    extendPrevious(currentFirst);
  }
  writer.write(END_CODE, bitsFor(nextCode));
  return writer.finish();
}

/** Reverse of compressText. Throws on a truncated or corrupt stream. */
export function decompressText(input: string): string {
  const reader = new BitReader(input);
  const entries: string[] = ['', ''];
  const out: string[] = [];
  let previous: string | null = null;
  for (;;) {
    const code = reader.read(bitsFor(entries.length));
    if (code === END_CODE) break;
    let entry: string;
    if (code === LITERAL_CODE) {
      entry = String.fromCharCode(reader.read(16));
      entries.push(entry);
    } else {
      const found = entries[code];
      if (found === undefined) throw new Error('Compressed save is corrupt.');
      entry = found;
    }
    if (previous !== null) entries.push(previous + entry.charAt(0));
    out.push(entry);
    previous = entry;
  }
  return out.join('');
}

/** Encode a save's JSON for storage. */
export function encodeSave(json: string): string {
  return COMPRESSED_SAVE_PREFIX + compressText(json);
}

/** Decode a stored save back to JSON. Raw JSON from older builds passes through. */
export function decodeSave(stored: string): string {
  if (!stored.startsWith(COMPRESSED_SAVE_PREFIX)) return stored;
  return decompressText(stored.slice(COMPRESSED_SAVE_PREFIX.length));
}
