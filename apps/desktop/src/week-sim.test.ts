import { describe, expect, it } from 'vitest';
import { createFreshLacrosseDynasty } from './dynasty-factory';
import { createScoutingState } from './scouting';
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
    scouting: createScoutingState(3),
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

  it('tracks the best national rank achieved by the user team', () => {
    const next = simulateOneWeek(freshState(), undefined, seededRandom(2));
    const userRank = next.rankings.find((r) => r.teamId === next.dynasty.userTeamId)?.rank ?? null;
    expect(next.bestNatRank).toBe(userRank);
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
