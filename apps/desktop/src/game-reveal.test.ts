import { describe, expect, it } from 'vitest';
import type { ScheduledGame } from '@sports-management-sim/engine-core';
import type { GameEvent, GameLog } from '@sports-management-sim/sport-lacrosse';
import { buildGameReveal, revealStamp } from './game-reveal';

const game = (home: number, away: number, overtime = false): ScheduledGame => ({
  id: 'g1',
  seasonYear: 2028,
  week: 3,
  homeTeamId: 'us',
  awayTeamId: 'them',
  conferenceGame: false,
  status: 'final',
  result: { homeScore: home, awayScore: away, winnerTeamId: home > away ? 'us' : 'them', loserTeamId: home > away ? 'them' : 'us', overtime },
});

const periodEnd = (period: GameEvent['period'], home: number, away: number): GameEvent => ({
  id: `p${period}`, period, timeElapsed: 900, type: 'period_end', teamId: 'us', homeScore: home, awayScore: away, description: '', isKeyPlay: false,
});
const log = (events: GameEvent[]): GameLog => ({ homeTeamId: 'us', awayTeamId: 'them', events, leadChanges: 0, biggestLead: 0 });

describe('buildGameReveal', () => {
  it('ticks the board through each quarter from the user’s side', () => {
    const r = buildGameReveal(
      { ...game(9, 11), homeTeamId: 'them', awayTeamId: 'us', result: { homeScore: 9, awayScore: 11, winnerTeamId: 'us', loserTeamId: 'them', overtime: false } },
      log([periodEnd(1, 2, 3), periodEnd(2, 5, 5), periodEnd(3, 7, 8), periodEnd(4, 9, 11)]),
      'us',
      { userRank: null, opponentRank: null },
    )!;
    expect(r.userIsHome).toBe(false);
    expect(r.periods).toEqual([
      { label: 'Q1', user: 3, opponent: 2 },
      { label: 'Q2', user: 5, opponent: 5 },
      { label: 'Q3', user: 8, opponent: 7 },
      { label: 'Q4', user: 11, opponent: 9 },
    ]);
    expect(r).toMatchObject({ userScore: 11, opponentScore: 9, won: true, opponentId: 'them' });
  });

  it('closes the board with the final when the log stops short', () => {
    const r = buildGameReveal(game(10, 9, true), log([periodEnd(4, 9, 9)]), 'us', { userRank: 5, opponentRank: 9 })!;
    expect(r.periods.at(-1)).toEqual({ label: 'Final', user: 10, opponent: 9 });
    expect(buildGameReveal(game(4, 5), undefined, 'us', { userRank: null, opponentRank: null })!.periods).toHaveLength(1);
  });

  it('stamps upsets, trophy games and losses', () => {
    expect(revealStamp(buildGameReveal(game(8, 6), undefined, 'us', { userRank: 14, opponentRank: 3 })!)).toBe('UPSET!');
    expect(revealStamp(buildGameReveal(game(8, 6), undefined, 'us', { userRank: null, opponentRank: 20 })!)).toBe('UPSET!');
    expect(revealStamp(buildGameReveal(game(8, 6), undefined, 'us', { userRank: 2, opponentRank: 20 })!)).toBe('WIN');
    expect(revealStamp(buildGameReveal(game(8, 6), undefined, 'us', { userRank: 2, opponentRank: 20, trophy: 'Old Stick' })!)).toBe('TROPHY WIN');
    expect(revealStamp(buildGameReveal(game(5, 6), undefined, 'us', { userRank: 2, opponentRank: 20 })!)).toBe('LOSS');
  });

  it('ignores games that are not final or not the user’s', () => {
    expect(buildGameReveal({ ...game(1, 0), status: 'scheduled' }, undefined, 'us', { userRank: null, opponentRank: null })).toBeNull();
    expect(buildGameReveal(game(1, 0), undefined, 'else', { userRank: null, opponentRank: null })).toBeNull();
  });
});
