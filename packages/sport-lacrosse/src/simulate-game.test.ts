import { describe, expect, it } from 'vitest';
import { makeLacrosseTeam, repeatingRandom } from './test-fixtures';
import { simulateLacrosseGame } from './simulate-game';

describe('simulateLacrosseGame', () => {
  it('returns a final score, winner, loser, and lacrosse team stats', () => {
    const home = makeLacrosseTeam('home');
    const away = makeLacrosseTeam('away');

    const result = simulateLacrosseGame({ homeTeam: home, awayTeam: away, random: repeatingRandom(0.5) });

    expect(Number.isInteger(result.homeScore)).toBe(true);
    expect(Number.isInteger(result.awayScore)).toBe(true);
    expect(result.homeScore).toBeGreaterThanOrEqual(0);
    expect(result.awayScore).toBeGreaterThanOrEqual(0);
    expect([home.id, away.id]).toContain(result.winnerTeamId);
    expect([home.id, away.id]).toContain(result.loserTeamId);
    expect(result.winnerTeamId).not.toBe(result.loserTeamId);
    expect(result.teamStats?.home.goals).toBe(result.homeScore);
    expect(result.teamStats?.away.goals).toBe(result.awayScore);
  });

  it('produces deterministic results from a deterministic random source', () => {
    const home = makeLacrosseTeam('home');
    const away = makeLacrosseTeam('away');

    const first = simulateLacrosseGame({ homeTeam: home, awayTeam: away, random: repeatingRandom(0.25) });
    const second = simulateLacrosseGame({ homeTeam: home, awayTeam: away, random: repeatingRandom(0.25) });

    expect(second).toEqual(first);
  });
});
