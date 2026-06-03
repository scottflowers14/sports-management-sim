import { describe, expect, it } from 'vitest';
import { createFreshLacrosseDynasty } from './dynasty-factory';

describe('createFreshLacrosseDynasty', () => {
  it('creates unique dynasty seeds even when the clock value repeats', () => {
    const first = createFreshLacrosseDynasty({ now: () => 2028 });
    const second = createFreshLacrosseDynasty({ now: () => 2028 });

    expect(second.seed).not.toBe(first.seed);
    expect(second.id).not.toBe(first.id);
    expect(second.recruits[0]?.id).not.toBe(first.recruits[0]?.id);
  });
});
