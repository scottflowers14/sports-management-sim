import { describe, expect, it } from 'vitest';
import type { ScheduledGame } from '@sports-management-sim/engine-core';
import type { DynastySeasonRecord } from './history';
import { allSeries, formatSeries, formatStreak, userSeasonGames, type SeasonGameRecord } from './series-history';
import type { TournamentState } from './tournament';

function game(week: number, home: string, away: string, homeScore: number, awayScore: number): ScheduledGame {
  const homeWon = homeScore > awayScore;
  return {
    id: `${week}-${home}-${away}`,
    seasonYear: 2028,
    week,
    homeTeamId: home,
    awayTeamId: away,
    conferenceGame: true,
    status: 'final',
    result: { homeScore, awayScore, winnerTeamId: homeWon ? home : away, loserTeamId: homeWon ? away : home, overtime: false },
  };
}

function season(year: number, games: SeasonGameRecord[]): DynastySeasonRecord {
  return { year, wins: 0, losses: 0, confStanding: 1, natRankAtEnd: null, confChampion: false, nationalChampion: false, signingClassSize: 0, games };
}

describe('userSeasonGames', () => {
  it('records regular-season games in week order, then postseason games', () => {
    const schedule = [game(2, 'b', 'us', 9, 11), game(1, 'us', 'a', 12, 7), game(1, 'c', 'd', 5, 4)];
    const tournament = {
      phase: 'complete',
      conferenceBrackets: [
        {
          conferenceId: 'x',
          seeds: ['us', 'a', 'c', 'd'],
          semifinal1: { id: 's1', homeTeamId: 'us', awayTeamId: 'd', conferenceId: 'x', result: { winnerId: 'd', loserId: 'us', winnerScore: 8, loserScore: 7, overtime: true } },
          semifinal2: { id: 's2', homeTeamId: 'a', awayTeamId: 'c', conferenceId: 'x' },
        },
      ],
    } as unknown as TournamentState;
    expect(userSeasonGames(schedule, tournament, 'us')).toEqual([
      { opponentId: 'a', goalsFor: 12, goalsAgainst: 7 },
      { opponentId: 'b', goalsFor: 11, goalsAgainst: 9 },
      { opponentId: 'd', goalsFor: 7, goalsAgainst: 8, postseason: true },
    ]);
  });
});

describe('allSeries', () => {
  it('adds up every meeting across seasons with the last result and streak', () => {
    const history = [
      season(2029, [{ opponentId: 'a', goalsFor: 5, goalsAgainst: 9 }]),
      season(2028, [{ opponentId: 'a', goalsFor: 10, goalsAgainst: 8 }, { opponentId: 'b', goalsFor: 3, goalsAgainst: 4 }]),
    ];
    const series = allSeries(history, { year: 2030, games: [{ opponentId: 'a', goalsFor: 6, goalsAgainst: 7, postseason: true }] });
    const a = series.get('a')!;
    expect(a).toMatchObject({ wins: 1, losses: 2, goalsFor: 21, goalsAgainst: 24 });
    expect(a.last).toEqual({ year: 2030, won: false, goalsFor: 6, goalsAgainst: 7, postseason: true });
    expect(formatStreak(a)).toBe('L2');
    expect(formatSeries(a)).toBe('1-2 (trail)');
    expect(formatSeries(series.get('b'))).toBe('0-1 (trail)');
    expect(formatSeries(series.get('z'))).toBe('First meeting');
  });

  it('skips seasons saved before game records existed', () => {
    const old: DynastySeasonRecord = { ...season(2027, []) };
    delete old.games;
    expect(allSeries([old]).size).toBe(0);
  });
});
