import { describe, expect, it } from 'vitest';
import type { Conference, ScheduledGame } from '@sports-management-sim/engine-core';
import { MORALE_BASELINE, weeklyMoraleChange } from './morale';
import { buildRivalries, recordRivalryGame, rivalryFor, rivalryForGame, seriesSummary } from './rivalries';
import { makeLacrossePlayer, makeLacrosseTeam } from './test-fixtures';

function conference(id: string, teamIds: string[]): Conference {
  return { id, name: id, shortName: id, teamIds, prestige: 50, regionIds: [] };
}

function team(id: string, regionId: string) {
  return { ...makeLacrosseTeam(id, []), regionId };
}

function game(home: string, away: string, homeScore: number, awayScore: number): ScheduledGame {
  const homeWon = homeScore > awayScore;
  return {
    id: `${home}-${away}`,
    seasonYear: 2028,
    week: 3,
    homeTeamId: home,
    awayTeamId: away,
    conferenceGame: true,
    status: 'final',
    result: {
      homeScore,
      awayScore,
      winnerTeamId: homeWon ? home : away,
      loserTeamId: homeWon ? away : home,
      overtime: false,
    },
  };
}

describe('rivalries', () => {
  const teams = [team('a', 'north'), team('b', 'south'), team('c', 'north'), team('d', 'south'), team('e', 'west')];
  const conferences = [conference('one', ['a', 'b', 'c', 'd', 'e'])];

  it('pairs conference neighbors, the same way every time', () => {
    const rivalries = buildRivalries(conferences, teams);
    expect(rivalries.map((r) => r.teamIds)).toEqual([
      ['a', 'c'],
      ['b', 'd'],
    ]);
    expect(buildRivalries(conferences, teams)).toEqual(rivalries);
    // Every rivalry has its own trophy, even with dozens of them.
    const many = Array.from({ length: 40 }, (_, i) => team(`t${i}`, 'north'));
    const big = buildRivalries([conference('big', many.map((t) => t.id))], many);
    expect(new Set(big.map((r) => r.trophy)).size).toBe(big.length);
    expect(rivalries[0]!.trophy).toMatch(/^The \w+ \w+$/);
    // The odd team out has no rival.
    expect(rivalryFor(rivalries, 'e')).toBeNull();
    expect(rivalryForGame(rivalries, { homeTeamId: 'c', awayTeamId: 'a' })?.key).toBe('a|c');
    expect(rivalryForGame(rivalries, { homeTeamId: 'a', awayTeamId: 'b' })).toBeNull();
  });

  it('keeps the series and the trophy holder across meetings', () => {
    const [rivalry] = buildRivalries(conferences, teams);
    let series = recordRivalryGame({}, rivalry!, game('a', 'c', 12, 9), 2028);
    series = recordRivalryGame(series, rivalry!, game('c', 'a', 8, 10), 2029);
    series = recordRivalryGame(series, rivalry!, game('a', 'c', 7, 11), 2030);
    const record = series[rivalry!.key]!;
    expect(record.wins).toEqual({ a: 2, c: 1 });
    expect(record.holderId).toBe('c');
    expect(record.recent.map((r) => `${r.year} ${r.winnerId} ${r.score}`)).toEqual(['2030 c 11-7', '2029 a 10-8', '2028 a 12-9']);
    expect(seriesSummary(record, 'a', 'c')).toBe('Leads the series 2-1');
    expect(seriesSummary(record, 'c', 'a')).toBe('Trails the series 1-2');
    expect(seriesSummary(undefined, 'a', 'c')).toBe('First meeting');
  });

  it('makes a rivalry result hit morale three times as hard', () => {
    const player = { ...makeLacrossePlayer(1, 'ATT'), morale: MORALE_BASELINE };
    const status = { expected: 'starter', actual: 'starter' } as const;
    const base = { intensity: 'normal' } as const;
    const normalWin = weeklyMoraleChange(player, status, { ...base, won: true });
    const rivalryWin = weeklyMoraleChange(player, status, { ...base, won: true, rivalry: true });
    const rivalryLoss = weeklyMoraleChange(player, status, { ...base, won: false, rivalry: true });
    expect(rivalryWin - normalWin).toBeCloseTo(1.6);
    expect(rivalryLoss).toBeLessThan(0);
  });
});
