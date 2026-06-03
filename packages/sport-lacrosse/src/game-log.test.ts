import { describe, expect, it } from 'vitest';
import { simulateLacrosseGameWithLog } from './game-log';
import { makeLacrosseTeam } from './test-fixtures';

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const homeTeam = makeLacrosseTeam('home-team');
const awayTeam = makeLacrosseTeam('away-team');

describe('simulateLacrosseGameWithLog', () => {
  it('log goal count matches homeScore + awayScore', () => {
    const random = seededRandom(42);
    const result = simulateLacrosseGameWithLog({ homeTeam, awayTeam, random });
    const goalEvents = result.log.events.filter((e) => e.type === 'goal');
    expect(goalEvents.length).toBe(result.homeScore + result.awayScore);
  });

  it('running score in events matches final result', () => {
    const random = seededRandom(7);
    const result = simulateLacrosseGameWithLog({ homeTeam, awayTeam, random });
    const goalEvents = result.log.events.filter((e) => e.type === 'goal');
    const last = goalEvents[goalEvents.length - 1];
    if (last) {
      expect(last.homeScore).toBe(result.homeScore);
      expect(last.awayScore).toBe(result.awayScore);
    }
  });

  it('is deterministic with the same RNG seed', () => {
    const r1 = seededRandom(99);
    const r2 = seededRandom(99);
    const a = simulateLacrosseGameWithLog({ homeTeam, awayTeam, random: r1 });
    const b = simulateLacrosseGameWithLog({ homeTeam, awayTeam, random: r2 });
    expect(a.homeScore).toBe(b.homeScore);
    expect(a.awayScore).toBe(b.awayScore);
    expect(a.log.events.length).toBe(b.log.events.length);
  });

  it('OT game has exactly one OT goal event', () => {
    let tries = 0;
    let found = false;
    for (let seed = 0; seed < 5000 && !found; seed++) {
      const random = seededRandom(seed);
      const result = simulateLacrosseGameWithLog({ homeTeam, awayTeam, random });
      if (!result.overtime) {
        tries++;
        continue;
      }
      const otGoals = result.log.events.filter((e) => e.type === 'goal' && e.period === 'OT');
      expect(otGoals.length).toBe(1);
      found = true;
    }
    expect(found).toBe(true);
  });

  it('log carries correct team IDs', () => {
    const random = seededRandom(12);
    const result = simulateLacrosseGameWithLog({ homeTeam, awayTeam, random });
    expect(result.log.homeTeamId).toBe(homeTeam.id);
    expect(result.log.awayTeamId).toBe(awayTeam.id);
  });

  it('biggestLead is non-negative', () => {
    const random = seededRandom(55);
    const result = simulateLacrosseGameWithLog({ homeTeam, awayTeam, random });
    expect(result.log.biggestLead).toBeGreaterThanOrEqual(0);
  });
});
