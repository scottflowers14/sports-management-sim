import { describe, expect, it } from 'vitest';
import { createFreshLacrosseDynasty } from './dynasty-factory';
import { createScoutingState } from './scouting';
import { emptyRecruitingActivity } from './recruiting-activity';
import { emptySeasonStats } from './stats';
import { simulateOneWeek, simulateRemainingWeeks, type WeekSimState } from './week-sim';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

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

describe('simulateOneWeek', () => {
  it('finalizes the current week, advances the week counter, and records side effects', () => {
    const state = freshState();
    const weekBefore = state.dynasty.season.currentWeek;

    const next = simulateOneWeek(state, undefined, seededRandom(1));

    expect(next.dynasty.season.currentWeek).toBe(weekBefore + 1);
    expect(next.lastSimWeek).toBe(weekBefore);
    const weekGames = next.dynasty.season.schedule.filter((g) => g.week === weekBefore);
    expect(weekGames.length).toBeGreaterThan(0);
    expect(weekGames.every((g) => g.status === 'final')).toBe(true);
    expect(next.rankings.length).toBeGreaterThan(0);
    expect(next.gameLogs.size).toBe(weekGames.length);
    expect(next.scouting.pointsAvailable).toBeGreaterThan(state.scouting.pointsAvailable);
    // Original state is untouched
    expect(state.dynasty.season.currentWeek).toBe(weekBefore);
    expect(state.gameLogs.size).toBe(0);
  });

  it('publishes a player of the week news item once goals are scored', () => {
    const next = simulateOneWeek(freshState(), undefined, seededRandom(5));
    const potw = next.newsItems.find((n) => n.headline.startsWith('Player of the Week:'));
    expect(potw).toBeDefined();
    expect(potw!.category).toBe('award');
    expect(potw!.headline).toMatch(/—\s\d+G, \d+A$/);
  });

  it('tracks the best national rank achieved by the user team', () => {
    const next = simulateOneWeek(freshState(), undefined, seededRandom(2));
    const userRank = next.rankings.find((r) => r.teamId === next.dynasty.userTeamId)?.rank ?? null;
    expect(next.bestNatRank).toBe(userRank);
  });
});

describe('recruiting actions in the weekly sim', () => {
  it('resolves campus visits, boosts interest, records the trend, and clears weekly activity', () => {
    const state = freshState();
    const target = state.dynasty.recruits.find((r) => r.status === 'open')!;
    const before = target.interestByTeamId[state.dynasty.userTeamId] ?? 0;

    const next = simulateOneWeek(
      { ...state, recruitingActivity: { visitIds: [target.id], pitchedIds: [] } },
      undefined,
      seededRandom(7),
    );

    const after = next.dynasty.recruits.find((r) => r.id === target.id)!;
    expect(after.interestByTeamId[next.dynasty.userTeamId] ?? 0).toBeGreaterThan(before);
    expect(next.newsItems.some((n) => n.headline.startsWith('Campus visit:'))).toBe(true);
    expect(next.recruitingActivity).toEqual({ visitIds: [], pitchedIds: [] });
    expect(next.recruitTrends[target.id]).toBeGreaterThan(0);
  });

  it('commits recruits over the season as their decision weeks arrive', () => {
    const done = simulateRemainingWeeks(freshState(), undefined, seededRandom(11));
    const committed = done.dynasty.recruits.filter((r) => r.status !== 'open');
    expect(committed.length).toBeGreaterThan(0);
    // Anyone who committed did so to a school that actually offered them.
    for (const recruit of committed) {
      const destination = recruit.committedTeamId ?? recruit.signedTeamId;
      expect(recruit.scholarshipOffers.some((o) => o.teamId === destination)).toBe(true);
    }
  });
});

describe('simulateRemainingWeeks', () => {
  it('simulates every remaining game in the season', () => {
    const done = simulateRemainingWeeks(freshState(), undefined, seededRandom(3));

    expect(done.dynasty.season.schedule.some((g) => g.status === 'scheduled')).toBe(false);
    expect(done.dynasty.season.schedule.every((g) => g.status === 'final')).toBe(true);
    const userTeam = done.dynasty.season.teams.find((t) => t.id === done.dynasty.userTeamId)!;
    expect(userTeam.record.wins + userTeam.record.losses).toBeGreaterThan(0);
  });
});
