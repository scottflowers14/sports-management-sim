import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createFreshLacrosseDynasty,
  getLacrosseDynastyTeamChoices,
  loadCustomTeamsConfig,
  programTier,
  recommendedStarterTeam,
} from './dynasty-factory';

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

describe('program tiers', () => {
  it('names the job from prestige', () => {
    expect(programTier(85)).toBe('Blue blood');
    expect(programTier(70)).toBe('Contender');
    expect(programTier(58)).toBe('Rising');
    expect(programTier(47)).toBe('Rebuild');
  });

  it('suggests the strongest Contender to a new coach, with every program in a named conference', () => {
    const choices = getLacrosseDynastyTeamChoices();
    expect(choices.every((c) => c.conferenceName)).toBe(true);
    const starter = recommendedStarterTeam(choices)!;
    expect(programTier(starter.prestige)).toBe('Contender');
    const contenders = choices.filter((c) => programTier(c.prestige) === 'Contender');
    expect(starter.prestige).toBe(Math.max(...contenders.map((c) => c.prestige)));
  });

  it('falls back to the program closest to a Contender when there are none', () => {
    const starter = recommendedStarterTeam([
      { id: 'a', name: 'A', prestige: 90 },
      { id: 'b', name: 'B', prestige: 60 },
    ]);
    expect(starter?.id).toBe('b');
  });
});
