import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_PLAN, getGamePlanModifiers, type LacrosseGamePlan } from './game-plan';
import { simulateLacrosseGame } from './simulate-game';
import { makeLacrosseTeam } from './test-fixtures';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe('game plan modifiers', () => {
  it('balanced plan applies no adjustments', () => {
    expect(getGamePlanModifiers(DEFAULT_GAME_PLAN)).toEqual({
      ownPossessions: 0,
      ownScoringChance: 0,
      oppPossessions: 0,
      oppScoringChance: 0,
    });
  });

  it('uptempo adds possessions and patient removes them, with opposite efficiency tradeoffs', () => {
    const uptempo = getGamePlanModifiers({ tempo: 'uptempo', defense: 'balanced' });
    const patient = getGamePlanModifiers({ tempo: 'patient', defense: 'balanced' });
    expect(uptempo.ownPossessions).toBeGreaterThan(0);
    expect(uptempo.ownScoringChance).toBeLessThan(0);
    expect(patient.ownPossessions).toBeLessThan(0);
    expect(patient.ownScoringChance).toBeGreaterThan(0);
  });

  it('pressure defense trades opponent possessions for easier opponent goals', () => {
    const pressure = getGamePlanModifiers({ tempo: 'balanced', defense: 'pressure' });
    const shell = getGamePlanModifiers({ tempo: 'balanced', defense: 'shell' });
    expect(pressure.oppPossessions).toBeLessThan(0);
    expect(pressure.oppScoringChance).toBeGreaterThan(0);
    expect(shell.oppPossessions).toBeGreaterThan(0);
    expect(shell.oppScoringChance).toBeLessThan(0);
  });
});

describe('simulateLacrosseGame with game plans', () => {
  const home = makeLacrosseTeam('home-team');
  const away = makeLacrosseTeam('away-team');

  it('produces identical results to a plan-free sim when both plans are balanced', () => {
    const base = simulateLacrosseGame({ homeTeam: home, awayTeam: away, random: seededRandom(42) });
    const planned = simulateLacrosseGame({
      homeTeam: home,
      awayTeam: away,
      random: seededRandom(42),
      homeGamePlan: DEFAULT_GAME_PLAN,
      awayGamePlan: DEFAULT_GAME_PLAN,
    });
    expect(planned).toEqual(base);
  });

  it('uptempo home plan adds exactly its possession bonus for the same seed', () => {
    const uptempoPlan: LacrosseGamePlan = { tempo: 'uptempo', defense: 'balanced' };
    const base = simulateLacrosseGame({ homeTeam: home, awayTeam: away, random: seededRandom(7) });
    const uptempo = simulateLacrosseGame({
      homeTeam: home,
      awayTeam: away,
      random: seededRandom(7),
      homeGamePlan: uptempoPlan,
    });
    // Possessions are surfaced as faceoff attempts in team stats
    expect(uptempo.teamStats!.home.faceoffAttempts - base.teamStats!.home.faceoffAttempts).toBe(5);
    expect(uptempo.teamStats!.away.faceoffAttempts).toBe(base.teamStats!.away.faceoffAttempts);
  });

  it('home pressure defense reduces away possessions for the same seed', () => {
    const pressurePlan: LacrosseGamePlan = { tempo: 'balanced', defense: 'pressure' };
    const base = simulateLacrosseGame({ homeTeam: home, awayTeam: away, random: seededRandom(7) });
    const pressured = simulateLacrosseGame({
      homeTeam: home,
      awayTeam: away,
      random: seededRandom(7),
      homeGamePlan: pressurePlan,
    });
    expect(pressured.teamStats!.away.faceoffAttempts - base.teamStats!.away.faceoffAttempts).toBe(-4);
  });

  it('still produces valid scores and a winner under extreme plans', () => {
    const result = simulateLacrosseGame({
      homeTeam: home,
      awayTeam: away,
      random: seededRandom(99),
      homeGamePlan: { tempo: 'uptempo', defense: 'pressure' },
      awayGamePlan: { tempo: 'patient', defense: 'shell' },
    });
    expect(result.homeScore).toBeGreaterThanOrEqual(0);
    expect(result.awayScore).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(result.homeScore)).toBe(true);
    expect(Number.isInteger(result.awayScore)).toBe(true);
    expect(result.homeScore).not.toBe(result.awayScore);
    expect([home.id, away.id]).toContain(result.winnerTeamId);
  });
});
