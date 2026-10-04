import { describe, expect, it } from 'vitest';
import { draftProductionScore } from './dynasty-helpers';
import type { PlayerSeasonStats } from './stats';

function line(overrides: Partial<PlayerSeasonStats>): PlayerSeasonStats {
  return {
    playerId: 'p',
    gamesPlayed: 14,
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
    ...overrides,
  };
}

describe('draftProductionScore', () => {
  it('grades scorers on points per game', () => {
    expect(draftProductionScore('ATT', line({ goals: 28, assists: 14 }))).toBe(7.5);
    expect(draftProductionScore('MID', line({ goals: 60, assists: 40 }))).toBe(10);
  });

  it('grades defenders on caused turnovers and ground balls', () => {
    expect(draftProductionScore('DEF', line({ causedTurnovers: 14, groundBalls: 28 }))).toBe(8);
  });

  it('grades specialists above a .450 rate', () => {
    expect(draftProductionScore('GK', line({ saves: 150, goalsAllowed: 100 }))).toBe(6);
    expect(draftProductionScore('GK', line({ saves: 80, goalsAllowed: 120 }))).toBe(0);
    expect(draftProductionScore('FOGO', line({ faceoffWins: 120, faceoffAttempts: 200 }))).toBe(6);
  });

  it('ignores a season too short to judge', () => {
    expect(draftProductionScore('ATT', line({ gamesPlayed: 3, goals: 20 }))).toBe(0);
    expect(draftProductionScore('ATT', undefined)).toBe(0);
  });
});
