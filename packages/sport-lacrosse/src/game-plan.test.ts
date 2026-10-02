import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_PLAN, getTacticEffects, normalizeGamePlan, ROTATION_SHARES, type LacrosseGamePlan } from './game-plan';
import { simulateLacrosseGame } from './simulate-game';
import { generateLacrosseRoster } from './roster-generation';
import { makeLacrosseTeam } from './test-fixtures';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe('tactic effects', () => {
  it('balanced plan applies no adjustments', () => {
    expect(getTacticEffects(DEFAULT_GAME_PLAN)).toMatchObject({
      possessionLength: 1,
      shotQuality: 0,
      turnoverRate: 1,
      forceTurnovers: 1,
      shotQualityAllowed: 0,
      penaltyRate: 1,
      rideClearFailure: 0,
    });
  });

  it('uptempo shortens possessions and patient lengthens them, with opposite shot-quality tradeoffs', () => {
    const uptempo = getTacticEffects({ ...DEFAULT_GAME_PLAN, tempo: 'uptempo' });
    const patient = getTacticEffects({ ...DEFAULT_GAME_PLAN, tempo: 'patient' });
    expect(uptempo.possessionLength).toBeLessThan(1);
    expect(uptempo.shotQuality).toBeLessThan(0);
    expect(uptempo.turnoverRate).toBeGreaterThan(1);
    expect(patient.possessionLength).toBeGreaterThan(1);
    expect(patient.shotQuality).toBeGreaterThan(0);
  });

  it('pressure defense trades takeaways and penalties for easier opponent goals', () => {
    const pressure = getTacticEffects({ ...DEFAULT_GAME_PLAN, defense: 'pressure' });
    const shell = getTacticEffects({ ...DEFAULT_GAME_PLAN, defense: 'shell' });
    expect(pressure.forceTurnovers).toBeGreaterThan(1);
    expect(pressure.shotQualityAllowed).toBeGreaterThan(0);
    expect(pressure.penaltyRate).toBeGreaterThan(1);
    expect(shell.forceTurnovers).toBeLessThan(1);
    expect(shell.shotQualityAllowed).toBeLessThan(0);
  });

  it('an aggressive ride forces failed clears but gives up transition', () => {
    const aggressive = getTacticEffects({ ...DEFAULT_GAME_PLAN, ride: 'aggressive' });
    const conservative = getTacticEffects({ ...DEFAULT_GAME_PLAN, ride: 'conservative' });
    expect(aggressive.rideClearFailure).toBeGreaterThan(conservative.rideClearFailure);
    expect(aggressive.rideTransitionAllowed).toBeGreaterThan(conservative.rideTransitionAllowed);
  });

  it('rotation shares always sum to one and a tight rotation leans on the first line', () => {
    for (const shares of Object.values(ROTATION_SHARES)) {
      expect(shares.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 5);
    }
    expect(ROTATION_SHARES.tight[0]).toBeGreaterThan(ROTATION_SHARES.deep[0]!);
    expect(ROTATION_SHARES.deep[2]).toBeGreaterThan(ROTATION_SHARES.tight[2]!);
  });

  it('fills in the axes an older save left out', () => {
    expect(normalizeGamePlan({ tempo: 'uptempo', defense: 'shell' })).toEqual({
      tempo: 'uptempo',
      defense: 'shell',
      ride: 'standard',
      rotation: 'balanced',
    });
    expect(normalizeGamePlan(undefined)).toEqual(DEFAULT_GAME_PLAN);
  });
});

describe('simulateLacrosseGame with game plans', () => {
  const home = makeLacrosseTeam('home-team', generateLacrosseRoster({ seed: 31, prestige: 60, createdSeason: 2028 }));
  const away = makeLacrosseTeam('away-team', generateLacrosseRoster({ seed: 32, prestige: 60, createdSeason: 2028 }));

  function averageOver(games: number, plan: Partial<LacrosseGamePlan>, awayPlan: Partial<LacrosseGamePlan> = DEFAULT_GAME_PLAN) {
    const random = seededRandom(1234);
    const totals = { possessions: 0, turnovers: 0, awayPossessions: 0, awayTurnovers: 0, awayClearFails: 0, penalties: 0, goals: 0 };
    for (let i = 0; i < games; i += 1) {
      const result = simulateLacrosseGame({ homeTeam: home, awayTeam: away, random, homeGamePlan: plan, awayGamePlan: awayPlan });
      const { home: h, away: a } = result.teamStats!;
      totals.possessions += h.clearAttempts + h.faceoffWins;
      totals.turnovers += h.turnovers;
      totals.awayPossessions += a.clearAttempts + a.faceoffWins;
      totals.awayTurnovers += a.turnovers;
      totals.awayClearFails += a.clearAttempts - a.clears;
      totals.penalties += h.penalties;
      totals.goals += h.goals;
    }
    return Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v / games])) as typeof totals;
  }

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

  it('an uptempo offense plays more possessions than a patient one', () => {
    const uptempo = averageOver(150, { tempo: 'uptempo' });
    const patient = averageOver(150, { tempo: 'patient' });
    expect(uptempo.possessions).toBeGreaterThan(patient.possessions + 4);
  });

  it('a pressure defense forces more opponent turnovers and takes more penalties than a shell', () => {
    const pressure = averageOver(150, { defense: 'pressure' });
    const shell = averageOver(150, { defense: 'shell' });
    expect(pressure.awayTurnovers).toBeGreaterThan(shell.awayTurnovers + 1.5);
    expect(pressure.penalties).toBeGreaterThan(shell.penalties);
  });

  it('an aggressive ride makes the opponent fail more clears', () => {
    const aggressive = averageOver(150, { ride: 'aggressive' });
    const conservative = averageOver(150, { ride: 'conservative' });
    expect(aggressive.awayClearFails).toBeGreaterThan(conservative.awayClearFails + 1);
  });

  it('still produces valid scores and a winner under extreme plans', () => {
    const result = simulateLacrosseGame({
      homeTeam: home,
      awayTeam: away,
      random: seededRandom(99),
      homeGamePlan: { tempo: 'uptempo', defense: 'pressure', ride: 'aggressive', rotation: 'tight' },
      awayGamePlan: { tempo: 'patient', defense: 'shell', ride: 'conservative', rotation: 'deep' },
    });
    expect(result.homeScore).toBeGreaterThanOrEqual(0);
    expect(result.awayScore).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(result.homeScore)).toBe(true);
    expect(result.homeScore).not.toBe(result.awayScore);
    expect([home.id, away.id]).toContain(result.winnerTeamId);
  });
});
