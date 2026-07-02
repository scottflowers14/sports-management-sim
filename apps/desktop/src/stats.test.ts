import { describe, expect, it } from 'vitest';
import { createFreshLacrosseDynasty } from './dynasty-factory';
import { simulateRemainingWeeks, type WeekSimState } from './week-sim';
import { createScoutingState } from './scouting';
import { emptyRecruitingActivity } from './recruiting-activity';
import { apportionByWeight, emptySeasonStats, type SeasonStatsMap } from './stats';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe('apportionByWeight', () => {
  it('distributes exactly the total across players', () => {
    const weights = [120, 95, 88, 140, 70, 110, 99, 102];
    const out = apportionByWeight(37, weights);
    expect(out.reduce((s, n) => s + n, 0)).toBe(37);
    expect(out.every((n) => n >= 0)).toBe(true);
  });

  it('never dumps everything on the last slot (the original scoring bug)', () => {
    // 22 attackers/middies, a low-scoring game: the old Math.round loop sent
    // every unallocated goal to the final roster slot.
    const weights = Array.from({ length: 22 }, (_, i) => 70 + ((i * 37) % 110));
    const out = apportionByWeight(6, weights);
    expect(out.reduce((s, n) => s + n, 0)).toBe(6);
    // No single player accounts for the whole team's output.
    expect(Math.max(...out)).toBeLessThan(6);
    // The last slot is not special-cased into a scoring monster.
    expect(out[out.length - 1]).toBeLessThanOrEqual(2);
  });

  it('skews extras toward higher-weighted players', () => {
    const out = apportionByWeight(10, [10, 200]);
    expect(out[1]).toBeGreaterThan(out[0]!);
    expect(out[0]! + out[1]!).toBe(10);
  });

  it('handles zero total and zero weights gracefully', () => {
    expect(apportionByWeight(0, [1, 2, 3])).toEqual([0, 0, 0]);
    const even = apportionByWeight(3, [0, 0, 0]);
    expect(even.reduce((s, n) => s + n, 0)).toBe(3);
  });
});

function freshState(): WeekSimState {
  return {
    dynasty: createFreshLacrosseDynasty(),
    rankings: [],
    injuries: [],
    newsItems: [],
    scouting: createScoutingState(),
    recruitingActivity: emptyRecruitingActivity(),
    recruitTrends: {},
    seasonStats: emptySeasonStats(),
    gameLogs: new Map(),
    bestNatRank: null,
    lastSimWeek: null,
  };
}

function topScorerShareByTeam(seasonStats: SeasonStatsMap, dynasty: WeekSimState['dynasty']): number {
  let worstShare = 0;
  for (const team of dynasty.season.teams) {
    const offensive = team.roster.filter((p) => p.position === 'ATT' || p.position === 'MID');
    const goals = offensive.map((p) => seasonStats[p.id]?.goals ?? 0);
    const teamGoals = goals.reduce((s, g) => s + g, 0);
    if (teamGoals === 0) continue;
    const share = Math.max(...goals) / teamGoals;
    worstShare = Math.max(worstShare, share);
  }
  return worstShare;
}

describe('season scoring distribution', () => {
  it('spreads goals across the roster rather than one player', () => {
    const finished = simulateRemainingWeeks(freshState(), undefined, seededRandom(7));
    // No team's leading scorer should monopolize their offense. With the old
    // bug this hit ~30%+ on a single low-rated player.
    const share = topScorerShareByTeam(finished.seasonStats, finished.dynasty);
    expect(share).toBeLessThan(0.25);
  });
});
