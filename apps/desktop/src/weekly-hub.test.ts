import { describe, expect, it } from 'vitest';
import { FEATURED_RESULTS, buildWeeklyHub, featuredResults, winProbability } from './weekly-hub';
import type { ScheduledGame } from '@sports-management-sim/engine-core';
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

describe('featuredResults', () => {
  const game = (id: string, home: string, away: string, homeScore: number, awayScore: number): ScheduledGame => ({
    id,
    seasonYear: 2028,
    week: 3,
    homeTeamId: home,
    awayTeamId: away,
    conferenceGame: false,
    status: 'final',
    result: { homeScore, awayScore, winnerTeamId: homeScore > awayScore ? home : away, loserTeamId: homeScore > awayScore ? away : home, overtime: false },
  });
  const ranks: Record<string, number> = { r1: 1, r5: 5, r25: 25 };
  const rankOf = (id: string) => ranks[id] ?? null;

  it('leads with your game, then ranked teams by rank, then the closest finishes', () => {
    const games = [
      game('blowout', 'x1', 'x2', 20, 5),
      game('close', 'x3', 'x4', 9, 8),
      game('top5', 'r5', 'x5', 12, 6),
      game('mine', 'x6', 'me', 4, 15),
      game('top1', 'x7', 'r1', 3, 18),
      game('unranked25', 'r25', 'x8', 10, 7),
    ];
    expect(featuredResults(games, 'me', rankOf, 5).map((g) => g.id)).toEqual(['mine', 'top1', 'top5', 'close', 'unranked25']);
  });

  it('keeps short weeks whole and caps long ones', () => {
    const many = Array.from({ length: 18 }, (_, i) => game(`g${i}`, `h${i}`, `a${i}`, 10, i % 5));
    expect(featuredResults(many, 'me', rankOf)).toHaveLength(FEATURED_RESULTS);
    expect(featuredResults(many.slice(0, 3), 'me', rankOf)).toHaveLength(3);
  });
});
