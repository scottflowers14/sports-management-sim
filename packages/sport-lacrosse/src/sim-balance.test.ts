import { describe, expect, it } from 'vitest';
import { generateLacrosseRoster } from './roster-generation';
import { makeLacrosseTeam } from './test-fixtures';
import { simulateLacrosseGame } from './simulate-game';
import { calculateLacrosseTeamRating } from './team-rating';

/**
 * League-wide balance guardrails. These run thousands of seeded games and
 * check the sim against real Division I men's lacrosse (roughly 11 goals and
 * 35 shots a team, a 55–60% save rate, home teams winning a bit more often).
 * A change that pushes the sim outside these ranges should be deliberate.
 */

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const teams = Array.from({ length: 24 }, (_, i) =>
  makeLacrosseTeam(`t${i}`, generateLacrosseRoster({ seed: i + 1, prestige: 45 + i * 2, createdSeason: 2028 })),
);
const rating = new Map(teams.map((t) => [t.id, calculateLacrosseTeamRating(t).overall]));

function runLeague(games: number, seed: number, neutralSite = false) {
  const random = seededRandom(seed);
  const totals = { games: 0, goals: 0, shots: 0, shotsOnGoal: 0, saves: 0, overtime: 0, homeWins: 0, evenGames: 0, evenHomeWins: 0, favGames: 0, favWins: 0 };
  for (let k = 0; k < games; k += 1) {
    const home = teams[Math.floor(random() * teams.length)]!;
    const away = teams[Math.floor(random() * teams.length)]!;
    if (home === away) continue;
    const result = simulateLacrosseGame({ homeTeam: home, awayTeam: away, random, neutralSite });
    const { home: h, away: a } = result.teamStats!;
    totals.games += 1;
    totals.goals += h.goals + a.goals;
    totals.shots += h.shots + a.shots;
    totals.shotsOnGoal += h.shotsOnGoal + a.shotsOnGoal;
    totals.saves += h.saves + a.saves;
    if (result.overtime) totals.overtime += 1;
    const homeWon = result.winnerTeamId === home.id;
    if (homeWon) totals.homeWins += 1;
    const gap = rating.get(home.id)! - rating.get(away.id)!;
    if (Math.abs(gap) <= 2) {
      totals.evenGames += 1;
      if (homeWon) totals.evenHomeWins += 1;
    }
    if (Math.abs(gap) >= 10) {
      totals.favGames += 1;
      if ((gap > 0) === homeWon) totals.favWins += 1;
    }
  }
  return totals;
}

describe('league balance', () => {
  const t = runLeague(4000, 11);

  it('scores like college lacrosse', () => {
    const goalsPerTeam = t.goals / t.games / 2;
    const shotsPerTeam = t.shots / t.games / 2;
    expect(goalsPerTeam).toBeGreaterThan(9);
    expect(goalsPerTeam).toBeLessThan(13);
    expect(shotsPerTeam).toBeGreaterThan(30);
    expect(shotsPerTeam).toBeLessThan(42);
  });

  it('keeps goalies in a realistic save range', () => {
    const savePct = t.saves / t.shotsOnGoal;
    expect(savePct).toBeGreaterThan(0.5);
    expect(savePct).toBeLessThan(0.65);
  });

  it('goes to overtime occasionally', () => {
    const otRate = t.overtime / t.games;
    expect(otRate).toBeGreaterThan(0.03);
    expect(otRate).toBeLessThan(0.15);
  });

  it('gives home teams a modest edge', () => {
    const evenHome = t.evenHomeWins / t.evenGames;
    expect(t.evenGames).toBeGreaterThan(200);
    expect(evenHome).toBeGreaterThan(0.52);
    expect(evenHome).toBeLessThan(0.65);
  });

  it('lets big favorites win most, but not all, of the time', () => {
    const favWin = t.favWins / t.favGames;
    expect(t.favGames).toBeGreaterThan(200);
    expect(favWin).toBeGreaterThan(0.8);
    expect(favWin).toBeLessThan(0.97);
  });

  it('removes the home edge at a neutral site', () => {
    const neutral = runLeague(4000, 11, true);
    expect(neutral.homeWins / neutral.games).toBeLessThan(t.homeWins / t.games);
    expect(Math.abs(neutral.evenHomeWins / neutral.evenGames - 0.5)).toBeLessThan(0.06);
  });
});
