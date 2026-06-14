import { describe, expect, it } from 'vitest';
import { buildWeeklyHub, winProbability } from './weekly-hub';
import { createFreshLacrosseDynasty } from './dynasty-factory';
import { emptySeasonStats } from './stats';

describe('winProbability', () => {
  it('is a coin flip at a neutral toss-up', () => {
    expect(winProbability(0, false, true)).toBe(50);
  });

  it('favors the home team and the higher-rated team', () => {
    expect(winProbability(0, true, false)).toBeGreaterThan(50);
    expect(winProbability(12, true, false)).toBeGreaterThan(winProbability(12, false, false));
    expect(winProbability(12, false, false)).toBeGreaterThan(70);
    expect(winProbability(-12, false, false)).toBeLessThan(30);
  });

  it('is symmetric around 50 for opposite edges on neutral sites', () => {
    expect(winProbability(8, false, true) + winProbability(-8, false, true)).toBe(100);
  });
});

describe('buildWeeklyHub', () => {
  it('builds a hub for the user team next game with key players and probability', () => {
    const dynasty = createFreshLacrosseDynasty();
    const hub = buildWeeklyHub({
      schedule: dynasty.season.schedule,
      teams: dynasty.season.teams,
      userTeamId: dynasty.userTeamId,
      currentWeek: dynasty.season.currentWeek,
      rankings: [],
      seasonStats: emptySeasonStats(),
    });

    expect(hub).not.toBeNull();
    expect(hub!.winProbability).toBeGreaterThanOrEqual(0);
    expect(hub!.winProbability).toBeLessThanOrEqual(100);
    // Both teams contribute a "player to watch"; with no stats it falls back to OVR.
    expect(hub!.keyPlayers.length).toBe(2);
    expect(hub!.keyPlayers.some((p) => p.isUser)).toBe(true);
    expect(hub!.keyPlayers.some((p) => !p.isUser)).toBe(true);
    expect(hub!.keyPlayers[0]!.line).toMatch(/OVR|G \d+A/);
    // No games have been played yet.
    expect(hub!.recentForm).toEqual([]);
  });

  it('returns null when the user has no remaining games', () => {
    const dynasty = createFreshLacrosseDynasty();
    const hub = buildWeeklyHub({
      schedule: [],
      teams: dynasty.season.teams,
      userTeamId: dynasty.userTeamId,
      currentWeek: 1,
      rankings: [],
      seasonStats: emptySeasonStats(),
    });
    expect(hub).toBeNull();
  });
});
