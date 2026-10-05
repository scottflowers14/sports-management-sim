import { describe, expect, it } from 'vitest';
import type { ScheduledGame } from '@sports-management-sim/engine-core';
import type { GameLog, LacrossePlayerGameStats } from '@sports-management-sim/sport-lacrosse';
import { gameLogColumns, playerGameLog, starCounts } from './player-game-log';

function line(extra: Partial<LacrossePlayerGameStats> = {}): LacrossePlayerGameStats {
  return { playerId: 'p1', teamId: 'us', goals: 2, assists: 1, shots: 6, shotsOnGoal: 4, groundBalls: 3, turnovers: 1, causedTurnovers: 0, penalties: 0, penaltyMinutes: 0, ...extra };
}

function game(id: string, week: number, home: string, away: string, homeScore: number, awayScore: number): ScheduledGame {
  return {
    id,
    seasonYear: 2029,
    week,
    homeTeamId: home,
    awayTeamId: away,
    conferenceGame: false,
    status: 'final',
    result: { homeScore, awayScore, winnerTeamId: homeScore > awayScore ? home : away, loserTeamId: homeScore > awayScore ? away : home, overtime: week === 3 },
  } as ScheduledGame;
}

const log = (lines: LacrossePlayerGameStats[]): GameLog => ({ homeTeamId: '', awayTeamId: '', events: [], leadChanges: 0, biggestLead: 0, playerLines: lines });

describe('playerGameLog', () => {
  it('lists the player’s games in week order from his side of the score', () => {
    const schedule = [
      game('g3', 3, 'them', 'us', 10, 11),
      game('g1', 1, 'us', 'a', 12, 9),
      game('g2', 2, 'b', 'us', 14, 6),
      { ...game('g4', 4, 'us', 'c', 0, 0), status: 'scheduled', result: undefined } as unknown as ScheduledGame,
    ];
    const logs = new Map([
      ['g1', log([line()])],
      ['g2', log([line({ goals: 0 })])],
      ['g3', log([line({ goals: 4 })])],
    ]);
    const rows = playerGameLog('p1', schedule, logs);
    expect(rows.map((r) => [r.week, r.opponentId, r.home, r.won, r.score, r.overtime])).toEqual([
      [1, 'a', true, true, '12-9', false],
      [2, 'b', false, false, '6-14', false],
      [3, 'them', false, true, '11-10', true],
    ]);
  });

  it('skips games trimmed from the save', () => {
    const rows = playerGameLog('p1', [game('g1', 1, 'us', 'a', 12, 9)], new Map([['g1', { homeTeamId: '', awayTeamId: '', events: [], leadChanges: 0, biggestLead: 0 } as GameLog]]));
    expect(rows).toEqual([]);
  });

  it('shows the stats that matter for the position', () => {
    expect(gameLogColumns('GK').map((c) => c.label)).toEqual(['SV', 'GA', 'SV%', 'GB']);
    const fo = gameLogColumns('FOGO');
    expect(fo[0]!.value(line({ faceoffWins: 14, faceoffAttempts: 20 }))).toBe('14-6');
    expect(fo[1]!.value(line({ faceoffWins: 14, faceoffAttempts: 20 }))).toBe('70%');
    expect(gameLogColumns('ATT')[2]!.value(line())).toBe('4/6');
  });
});

describe('stars in the game log', () => {
  it('marks the games where he was a star and counts them', () => {
    const schedule = [game('g1', 1, 'us', 'a', 12, 9), game('g2', 2, 'us', 'b', 10, 8)];
    const other = (id: string, goals: number) => line({ playerId: id, goals, assists: 0, groundBalls: 0, turnovers: 0 });
    const logs = new Map([
      // Only line in the game: first star.
      ['g1', log([line()])],
      // Three teammates outscore him: no star.
      ['g2', log([line({ goals: 0, assists: 0, groundBalls: 0 }), other('x', 5), other('y', 4), other('z', 3)])],
    ]);
    const rows = playerGameLog('p1', schedule, logs);
    expect(rows.map((r) => r.star)).toEqual([1, undefined]);
    expect(starCounts(rows)).toEqual([1, 0, 0]);
  });
});
