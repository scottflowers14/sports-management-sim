import { describe, expect, it } from 'vitest';
import { generateLacrosseRoster } from '@sports-management-sim/sport-lacrosse';
import { comparePlayers, compareTally } from './player-compare';
import type { PlayerSeasonStats } from './stats';

const roster = generateLacrosseRoster({ seed: 5, prestige: 60, createdSeason: 2028 });
const attack = roster.filter((p) => p.position === 'ATT');
const goalie = roster.find((p) => p.position === 'GK')!;

function stats(playerId: string, over: Partial<PlayerSeasonStats>): PlayerSeasonStats {
  return {
    playerId, gamesPlayed: 5, goals: 0, assists: 0, shots: 0, groundBalls: 0, turnovers: 0,
    causedTurnovers: 0, faceoffWins: 0, faceoffAttempts: 0, saves: 0, goalsAllowed: 0, ...over,
  };
}

describe('comparePlayers', () => {
  it('marks the better player on each rating', () => {
    const [a, b] = [attack[0]!, { ...attack[1]!, ratings: { ...attack[1]!.ratings, overall: attack[0]!.ratings.overall - 3 } }];
    const sections = comparePlayers(a, b);
    const overall = sections[0]!.rows.find((r) => r.label === 'Overall')!;
    expect(overall).toMatchObject({ a: a.ratings.overall, b: a.ratings.overall - 3, edge: 'a' });
    const even = comparePlayers(a, a)[0]!.rows;
    expect(even.every((r) => r.edge === 'even')).toBe(true);
  });

  it('shows skills only one position has as missing for the other', () => {
    const sections = comparePlayers(attack[0]!, goalie);
    const skills = sections.find((s) => s.title === 'Skills')!.rows;
    expect(skills.some((r) => r.a !== null && r.b === null)).toBe(true);
    expect(skills.some((r) => r.a === null && r.b !== null)).toBe(true);
    expect(skills.filter((r) => r.a === null || r.b === null).every((r) => r.edge === null)).toBe(true);
  });

  it('treats fewer turnovers as better and drops stats both players lack', () => {
    const a = attack[0]!;
    const b = attack[1]!;
    const sections = comparePlayers(a, b, {
      a: stats(a.id, { goals: 10, turnovers: 6 }),
      b: stats(b.id, { goals: 12, turnovers: 2 }),
    });
    const season = sections.find((s) => s.title === 'This season')!.rows;
    expect(season.map((r) => r.label)).toEqual(['Games', 'Goals', 'Points', 'Turnovers']);
    expect(season.find((r) => r.label === 'Turnovers')).toMatchObject({ edge: 'b', lowerIsBetter: true });
    expect(season.find((r) => r.label === 'Goals')!.edge).toBe('b');
    const tally = compareTally(sections);
    expect(tally.a + tally.b).toBeGreaterThan(0);
  });
});
