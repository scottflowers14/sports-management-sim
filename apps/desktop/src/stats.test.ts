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
    // Fixed seed: an unseeded dynasty made these distribution checks flaky.
    dynasty: createFreshLacrosseDynasty({ now: () => 1_000 }),
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

/** Each team's top scorer's share of its goals, sorted low to high. */
function topScorerShares(seasonStats: SeasonStatsMap, dynasty: WeekSimState['dynasty']): number[] {
  const shares: number[] = [];
  for (const team of dynasty.season.teams) {
    const offensive = team.roster.filter((p) => p.position === 'ATT' || p.position === 'MID');
    const goals = offensive.map((p) => seasonStats[p.id]?.goals ?? 0);
    const teamGoals = goals.reduce((s, g) => s + g, 0);
    if (teamGoals === 0) continue;
    shares.push(Math.max(...goals) / teamGoals);
  }
  return shares.sort((a, b) => a - b);
}

describe('season scoring distribution', () => {
  it('spreads goals across the roster rather than one player', () => {
    const finished = simulateRemainingWeeks(freshState(), undefined, seededRandom(7));
    // Stars should lead their teams, but no one player should monopolize the
    // offense. Real D1 leaders take roughly 20-35% of their team's goals; a
    // lone star on a thin roster can go a little higher.
    const shares = topScorerShares(finished.seasonStats, finished.dynasty);
    expect(shares[Math.floor(shares.length / 2)]).toBeLessThan(0.3);
    expect(shares.at(-1)).toBeLessThan(0.5);
  });

  it('produces star scorers instead of a flat league', () => {
    const finished = simulateRemainingWeeks(freshState(), undefined, seededRandom(11));
    const points = Object.values(finished.seasonStats).map((s) => s.goals + s.assists).sort((a, b) => b - a);
    // The old even split capped the national leader near 18 points over 10 games.
    expect(points[0]).toBeGreaterThan(35);
    expect(points[0]! - points[14]!).toBeGreaterThan(5);
  });

  it('only credits games played to players who take the field', () => {
    const state = freshState();
    const injured = state.dynasty.season.teams[0]!.roster[0]!;
    const finished = simulateRemainingWeeks(
      { ...state, injuries: [{ playerId: injured.id, teamId: state.dynasty.season.teams[0]!.id, weeksRemaining: 99 }] },
      undefined,
      seededRandom(5),
    );
    expect(finished.seasonStats[injured.id]?.gamesPlayed ?? 0).toBe(0);
    // Each team suits up its playing group, not all 42 players, and exactly
    // one goalie plays each game.
    for (const team of finished.dynasty.season.teams) {
      const teamGames = team.record.wins + team.record.losses;
      const goalieGames = team.roster
        .filter((p) => p.position === 'GK')
        .reduce((n, p) => n + (finished.seasonStats[p.id]?.gamesPlayed ?? 0), 0);
      expect(goalieGames).toBe(teamGames);
      const appeared = team.roster.filter((p) => (finished.seasonStats[p.id]?.gamesPlayed ?? 0) > 0);
      expect(appeared.length).toBeLessThan(team.roster.length);
    }
  });
});
