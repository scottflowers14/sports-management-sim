import { describe, expect, it } from 'vitest';
import { generateLacrosseRoster } from './roster-generation';
import { simulateLacrosseGame } from './simulate-game';
import { calculateLacrosseTeamRating } from './team-rating';
import { makeLacrosseTeam } from './test-fixtures';
import { lacrosseWinProbability } from './win-probability';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe('lacrosseWinProbability', () => {
  it('is symmetric, even at a neutral site, and favors the home team', () => {
    expect(lacrosseWinProbability(0, false, true)).toBe(50);
    expect(lacrosseWinProbability(8, false, true) + lacrosseWinProbability(-8, false, true)).toBe(100);
    expect(lacrosseWinProbability(0, true, false)).toBeGreaterThan(52);
    expect(lacrosseWinProbability(0, true, false)).toBeLessThan(60);
  });

  // The Week Hub shows this number before every game, so it should match
  // what the sim actually does: predicted and simulated win rates agree
  // within a few points across rating edges.
  it('matches simulated results across rating edges', () => {
    const random = seededRandom(5);
    const teams = Array.from({ length: 16 }, (_, i) =>
      makeLacrosseTeam(`t${i}`, generateLacrosseRoster({ seed: 100 + i, prestige: 40 + i * 3.3, createdSeason: 2028 })),
    );
    const overall = new Map(teams.map((t) => [t.id, calculateLacrosseTeamRating(t).overall]));
    const buckets = new Map<number, { wins: number; games: number; predicted: number }>();
    for (const home of teams) {
      for (const away of teams) {
        if (home === away) continue;
        const edge = overall.get(home.id)! - overall.get(away.id)!;
        const bucket = Math.round(edge / 4) * 4;
        const entry = buckets.get(bucket) ?? { wins: 0, games: 0, predicted: 0 };
        for (let k = 0; k < 24; k += 1) {
          const game = simulateLacrosseGame({ homeTeam: home, awayTeam: away, random, neutralSite: true });
          entry.wins += game.winnerTeamId === home.id ? 1 : 0;
          entry.games += 1;
          entry.predicted += lacrosseWinProbability(edge, true, true) / 100;
        }
        buckets.set(bucket, entry);
      }
    }
    const checked = [...buckets.values()].filter((b) => b.games >= 600);
    expect(checked.length).toBeGreaterThanOrEqual(5);
    for (const b of checked) expect(Math.abs(b.wins / b.games - b.predicted / b.games)).toBeLessThan(0.045);
  }, 60_000);
});
