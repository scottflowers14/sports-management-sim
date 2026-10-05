import { describe, expect, it } from 'vitest';
import type { ScheduledGame } from '@sports-management-sim/engine-core';
import { rivalryKey, type Rivalry } from './rivalries';
import { splitWinPct, teamSplits, type TeamSplitKey } from './team-splits';

function game(
  week: number,
  home: string,
  away: string,
  homeScore: number,
  awayScore: number,
  opts: { conferenceGame?: boolean; overtime?: boolean; final?: boolean } = {},
): ScheduledGame {
  const homeWon = homeScore > awayScore;
  const final = opts.final ?? true;
  return {
    id: `${week}-${home}-${away}`,
    seasonYear: 2028,
    week,
    homeTeamId: home,
    awayTeamId: away,
    conferenceGame: opts.conferenceGame ?? true,
    status: final ? 'final' : 'scheduled',
    ...(final
      ? {
          result: {
            homeScore,
            awayScore,
            winnerTeamId: homeWon ? home : away,
            loserTeamId: homeWon ? away : home,
            overtime: opts.overtime ?? false,
          },
        }
      : {}),
  };
}

function byKey(schedule: ScheduledGame[], teamId: string, rivalries: Rivalry[] = []) {
  return new Map(teamSplits(schedule, teamId, rivalries).map((s) => [s.key, s] as [TeamSplitKey, typeof s]));
}

describe('teamSplits', () => {
  it('splits a record by venue, conference, margin and overtime', () => {
    const schedule = [
      game(1, 'us', 'a', 12, 7, { conferenceGame: false }),
      game(2, 'b', 'us', 10, 9, { overtime: true }),
      game(3, 'us', 'c', 11, 10),
      game(4, 'd', 'us', 4, 13),
      game(5, 'us', 'a', 0, 0, { final: false }),
    ];
    const s = byKey(schedule, 'us');
    expect(s.get('overall')).toMatchObject({ wins: 3, losses: 1, goalsFor: 45, goalsAgainst: 31 });
    expect(s.get('home')).toMatchObject({ wins: 2, losses: 0 });
    expect(s.get('away')).toMatchObject({ wins: 1, losses: 1 });
    expect(s.get('conference')).toMatchObject({ wins: 2, losses: 1 });
    expect(s.get('nonConference')).toMatchObject({ wins: 1, losses: 0 });
    expect(s.get('oneGoal')).toMatchObject({ wins: 1, losses: 1 });
    expect(s.get('blowouts')).toMatchObject({ wins: 2, losses: 0 });
    expect(s.get('overtime')).toMatchObject({ wins: 0, losses: 1 });
    expect(splitWinPct(s.get('overall')!)).toBe(0.75);
  });

  it('judges winning opponents on their record outside the game', () => {
    const schedule = [
      // a beats us, then beats b: 2-0 overall, 1-0 outside our game.
      game(1, 'a', 'us', 9, 8),
      game(2, 'a', 'b', 10, 5),
      // c only ever played us; it is 1-0 but 0-0 outside the game.
      game(3, 'c', 'us', 9, 6),
    ];
    const s = byKey(schedule, 'us');
    expect(s.get('vsWinning')).toMatchObject({ wins: 0, losses: 1 });
  });

  it('counts rivalry games and keeps only the last five in Last 5', () => {
    const rivalry: Rivalry = { key: rivalryKey('us', 'r'), teamIds: ['us', 'r'], trophy: 'Cup' };
    const schedule = [
      game(1, 'us', 'r', 5, 9),
      ...[2, 3, 4, 5, 6].map((w) => game(w, 'us', `t${w}`, 10, 8)),
    ];
    const s = byKey(schedule, 'us', [rivalry]);
    expect(s.get('rivalry')).toMatchObject({ wins: 0, losses: 1 });
    expect(s.get('lastFive')).toMatchObject({ wins: 5, losses: 0 });
  });

  it('returns every split even before any game is played', () => {
    const splits = teamSplits([game(1, 'us', 'a', 0, 0, { final: false })], 'us');
    expect(splits).toHaveLength(11);
    expect(splits.every((s) => s.wins + s.losses === 0)).toBe(true);
  });
});
