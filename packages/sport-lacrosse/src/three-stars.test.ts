import { describe, expect, it } from 'vitest';
import type { LacrossePlayerGameStats } from './models';
import { gameStarLine, gameStarScore, threeStars } from './three-stars';

function line(playerId: string, teamId: string, over: Partial<LacrossePlayerGameStats>): LacrossePlayerGameStats {
  return {
    playerId, teamId, goals: 0, assists: 0, shots: 0, shotsOnGoal: 0, groundBalls: 0, turnovers: 0,
    causedTurnovers: 0, penalties: 0, penaltyMinutes: 0, ...over,
  };
}

describe('threeStars', () => {
  it('ranks scorers, goalies and faceoff men on one scale', () => {
    const lines = [
      line('att', 'w', { goals: 4, assists: 1 }),
      line('gk', 'l', { saves: 18, goalsAllowed: 9 }),
      line('fo', 'w', { faceoffWins: 16, faceoffAttempts: 22, groundBalls: 6 }),
      line('mid', 'l', { goals: 1, turnovers: 3 }),
      line('bench', 'w', {}),
    ];
    const stars = threeStars(lines, 'w');
    expect(stars.map((s) => s.playerId)).toEqual(['att', 'fo', 'gk']);
    expect(stars[0]!.line).toBe('4G 1A');
    expect(stars[1]!.line).toBe('16/22 FO 6 GB');
  });

  it('breaks ties toward the winner and skips empty lines', () => {
    const stars = threeStars([line('a', 'l', { goals: 2 }), line('b', 'w', { goals: 2 }), line('c', 'w', {})], 'w');
    expect(stars.map((s) => s.playerId)).toEqual(['b', 'a']);
  });

  it('never credits a shelled goalie', () => {
    expect(gameStarScore(line('gk', 'l', { saves: 4, goalsAllowed: 15 }))).toBe(0);
    expect(gameStarLine(line('x', 'w', {}))).toBe('—');
  });
});
