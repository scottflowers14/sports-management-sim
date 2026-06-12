import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFreshLacrosseDynasty, loadCustomTeamsConfig } from './dynasty-factory';

describe('createFreshLacrosseDynasty', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates unique dynasty seeds even when the clock value repeats', () => {
    const first = createFreshLacrosseDynasty({ now: () => 2028 });
    const second = createFreshLacrosseDynasty({ now: () => 2028 });

    expect(second.seed).not.toBe(first.seed);
    expect(second.id).not.toBe(first.id);
    expect(second.recruits[0]?.id).not.toBe(first.recruits[0]?.id);
  });

  it('ignores a non-Storage localStorage shim when loading custom teams', () => {
    vi.stubGlobal('localStorage', {});

    expect(loadCustomTeamsConfig()).toBeNull();
  });
});
