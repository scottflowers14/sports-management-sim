import { describe, expect, it } from 'vitest';
import { challengeMet, challengesCompleted, weeklyChallenge } from './challenges';

describe('weekly challenges', () => {
  it('asks favorites to dominate and underdogs to compete', () => {
    expect(['win-by', 'hold', 'score']).toContain(weeklyChallenge(12, 1).kind);
    expect(weeklyChallenge(12, 1)).toMatchObject({ kind: 'hold', target: 7 });
    expect(weeklyChallenge(0, 2)).toMatchObject({ kind: 'win', xp: 20 });
    expect(weeklyChallenge(-10, 0)).toMatchObject({ kind: 'within', target: 3 });
    // The underdog upset pays the most.
    expect(weeklyChallenge(-10, 1)).toMatchObject({ kind: 'win', xp: 35 });
  });

  it('rotates through the options by week', () => {
    const kinds = new Set([0, 1, 2].map((w) => weeklyChallenge(10, w).kind));
    expect(kinds).toEqual(new Set(['win-by', 'hold', 'score']));
    expect(weeklyChallenge(10, 3)).toEqual(weeklyChallenge(10, 0));
  });

  it('judges each kind of target', () => {
    const game = (goalsFor: number, goalsAgainst: number) => ({ goalsFor, goalsAgainst });
    expect(challengeMet(weeklyChallenge(10, 0), game(12, 6))).toBe(true); // win by 6
    expect(challengeMet(weeklyChallenge(10, 0), game(12, 7))).toBe(false);
    expect(challengeMet(weeklyChallenge(10, 1), game(5, 7))).toBe(true); // hold to 7, even in a loss
    expect(challengeMet(weeklyChallenge(10, 2), game(15, 14))).toBe(true); // score 15
    expect(challengeMet(weeklyChallenge(-10, 0), game(8, 11))).toBe(true); // lose by 3
    expect(challengeMet(weeklyChallenge(-10, 0), game(8, 12))).toBe(false);
    expect(challengeMet(weeklyChallenge(0, 0), game(9, 9))).toBe(false);
  });

  it('counts completed challenges', () => {
    const base = { year: 2028, week: 1, opponentId: 'x', text: '', xp: 20 };
    expect(challengesCompleted([{ ...base, completed: true }, { ...base, completed: false }, { ...base, completed: true }])).toBe(2);
  });
});
