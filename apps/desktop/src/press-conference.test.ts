import { describe, expect, it } from 'vitest';
import type { ScheduledGame } from '@sports-management-sim/engine-core';
import { describeEffects, pressConferenceFor, pressTopic, type PressGameContext } from './press-conference';

function game(homeScore: number, awayScore: number): ScheduledGame {
  return {
    id: 'g1',
    seasonYear: 2029,
    week: 3,
    homeTeamId: 'us',
    awayTeamId: 'them',
    conferenceGame: false,
    status: 'final',
    result: {
      homeScore,
      awayScore,
      winnerTeamId: homeScore > awayScore ? 'us' : 'them',
      loserTeamId: homeScore > awayScore ? 'them' : 'us',
      overtime: false,
    },
  } as ScheduledGame;
}

const ctx = (g: ScheduledGame, extra: Partial<PressGameContext> = {}): PressGameContext => ({
  game: g,
  userTeamId: 'us',
  opponentName: 'Harbor City',
  userOverall: 72,
  opponentOverall: 72,
  rivalry: false,
  ...extra,
});

describe('press conference', () => {
  it('reads the game', () => {
    expect(pressTopic(ctx(game(10, 9)))).toBe('win');
    expect(pressTopic(ctx(game(15, 6)))).toBe('blowout_win');
    expect(pressTopic(ctx(game(10, 9), { opponentOverall: 78 }))).toBe('upset_win');
    expect(pressTopic(ctx(game(9, 10), { opponentOverall: 66 }))).toBe('upset_loss');
    expect(pressTopic(ctx(game(4, 14)))).toBe('blowout_loss');
    expect(pressTopic(ctx(game(9, 10), { rivalry: true }))).toBe('rivalry_loss');
    expect(pressTopic(ctx({ ...game(1, 0), result: undefined } as unknown as ScheduledGame))).toBeNull();
  });

  it('offers trade-offs, doubled in a rivalry game', () => {
    const loss = pressConferenceFor(ctx(game(9, 10)))!;
    expect(loss.question).toContain('Harbor City');
    expect(loss.answers.map((a) => a.id)).toEqual(['blame', 'callout', 'credit']);
    const callout = loss.answers.find((a) => a.id === 'callout')!.effects;
    expect(callout.morale).toBeLessThan(0);
    expect(callout.adConfidence).toBeGreaterThan(0);
    const rivalry = pressConferenceFor(ctx(game(9, 10), { rivalry: true }))!;
    expect(rivalry.answers.find((a) => a.id === 'callout')!.effects).toEqual({
      morale: callout.morale * 2,
      adConfidence: callout.adConfidence * 2,
      recruitBuzz: 0,
    });
    const win = pressConferenceFor(ctx(game(12, 8)))!;
    expect(win.answers.find((a) => a.id === 'sell')!.effects.recruitBuzz).toBeGreaterThan(0);
    expect(describeEffects({ morale: 4, adConfidence: -2, recruitBuzz: 0 })).toBe('+4 morale, -2 AD confidence');
  });
});
