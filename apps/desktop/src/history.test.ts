import { describe, expect, it } from 'vitest';
import {
  buildRecordBook,
  deriveSeasonLeader,
  toSeasonAwardRecords,
  type DynastySeasonRecord,
} from './history';
import type { SeasonAwards } from './awards';
import type { SeasonStatsMap } from './stats';
import type { LacrosseTeam } from '@sports-management-sim/sport-lacrosse';

function record(partial: Partial<DynastySeasonRecord> & { year: number }): DynastySeasonRecord {
  return {
    wins: 10,
    losses: 4,
    confStanding: 2,
    natRankAtEnd: 8,
    confChampion: false,
    nationalChampion: false,
    signingClassSize: 5,
    ...partial,
  };
}

describe('buildRecordBook', () => {
  it('derives single-season records across the dynasty (newest-first input)', () => {
    const history: DynastySeasonRecord[] = [
      record({ year: 2027, wins: 16, losses: 2, natRankAtEnd: 1, confChampion: true, nationalChampion: true,
        teamLeader: { playerName: 'Ace', position: 'ATT', goals: 40, assists: 25, points: 65 } }),
      record({ year: 2026, wins: 12, losses: 5, natRankAtEnd: 4,
        teamLeader: { playerName: 'Bo', position: 'MID', goals: 30, assists: 20, points: 50 } }),
      record({ year: 2025, wins: 8, losses: 8, natRankAtEnd: 18 }),
    ];

    const book = buildRecordBook(history);
    expect(book.mostWins).toEqual({ value: 16, year: 2027 });
    expect(book.bestScoringSeason).toEqual({ value: 65, player: 'Ace', year: 2027 });
    expect(book.bestFinish).toEqual({ value: 1, year: 2027 });
    expect(book.confTitles).toBe(1);
    expect(book.natTitles).toBe(1);
  });

  it('tracks the longest streak of winning seasons in chronological order', () => {
    const history: DynastySeasonRecord[] = [
      record({ year: 2028, wins: 11, losses: 4 }),
      record({ year: 2027, wins: 12, losses: 3 }),
      record({ year: 2026, wins: 3, losses: 12 }),
      record({ year: 2025, wins: 9, losses: 6 }),
    ];
    expect(buildRecordBook(history).longestWinStreakSeasons).toBe(2);
  });
});

describe('deriveSeasonLeader', () => {
  it('returns the top points scorer with games played', () => {
    const team = {
      roster: [
        { id: 'a', name: { first: 'Star', last: 'One' }, position: 'ATT' },
        { id: 'b', name: { first: 'Role', last: 'Two' }, position: 'MID' },
        { id: 'c', name: { first: 'Bench', last: 'Three' }, position: 'ATT' },
      ],
    } as unknown as LacrosseTeam;
    const stats: SeasonStatsMap = {
      a: blank('a', { gamesPlayed: 14, goals: 20, assists: 10 }),
      b: blank('b', { gamesPlayed: 14, goals: 35, assists: 5 }),
      c: blank('c', { gamesPlayed: 0 }),
    };
    const leader = deriveSeasonLeader(team, stats);
    expect(leader?.playerName).toBe('Role Two');
    expect(leader?.points).toBe(40);
  });

  it('returns undefined when nobody has scored', () => {
    const team = { roster: [{ id: 'a', name: { first: 'X', last: 'Y' }, position: 'ATT' }] } as unknown as LacrosseTeam;
    expect(deriveSeasonLeader(team, { a: blank('a', { gamesPlayed: 14 }) })).toBeUndefined();
    expect(deriveSeasonLeader(undefined, {})).toBeUndefined();
  });
});

describe('toSeasonAwardRecords', () => {
  it('flattens awards and drops a missing freshman winner', () => {
    const awards: SeasonAwards = {
      seasonYear: 2026,
      mvp: { playerName: 'M', teamName: 'maryland-state', position: 'ATT', overall: 90, statLine: '40G, 20A' },
      offensivePlayer: { playerName: 'O', teamName: 'duke', position: 'MID', overall: 88 },
      defensivePlayer: { playerName: 'D', teamName: 'army', position: 'GK', overall: 85 },
      freshmanOfYear: null,
      allConference: [],
    };
    const records = toSeasonAwardRecords(awards);
    expect(records.map((r) => r.award)).toEqual(['MVP', 'Offensive POY', 'Defensive POY']);
    expect(records[0]!.statLine).toBe('40G, 20A');
    expect(toSeasonAwardRecords(null)).toEqual([]);
  });
});

function blank(playerId: string, over: Partial<SeasonStatsMap[string]>): SeasonStatsMap[string] {
  return {
    playerId,
    gamesPlayed: 0,
    goals: 0,
    assists: 0,
    shots: 0,
    groundBalls: 0,
    turnovers: 0,
    causedTurnovers: 0,
    faceoffWins: 0,
    faceoffAttempts: 0,
    saves: 0,
    goalsAllowed: 0,
    ...over,
  };
}
