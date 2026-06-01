import { describe, expect, it } from 'vitest';
import { failure, success } from './result';

describe('Result helpers', () => {
  it('represents success and failure values', () => {
    expect(success(123)).toEqual({ ok: true, value: 123 });
    expect(failure('bad')).toEqual({ ok: false, error: 'bad' });
  });
});
