import { describe, expect, it } from 'vitest';
import { generateLacrosseRoster } from './roster-generation';
import { getLacrosseParticipationMinutes } from './player-stats';
import {
  GAME_INJURY_RATE,
  LACROSSE_INJURY_TYPES,
  lacrosseInjuryProneness,
  rollLacrosseInjuries,
  type LacrosseInjury,
} from './injuries';
import { makeLacrosseTeam } from './test-fixtures';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const team = makeLacrosseTeam('durham', generateLacrosseRoster({ seed: 7, prestige: 70, createdSeason: 2028 }));

/** Roll many team-weeks and collect every injury. */
function sample(weeks: number, played: boolean, seed = 1): LacrosseInjury[] {
  const random = seededRandom(seed);
  const out: LacrosseInjury[] = [];
  for (let w = 0; w < weeks; w += 1) out.push(...rollLacrosseInjuries(team, { played, random }));
  return out;
}

describe('getLacrosseParticipationMinutes', () => {
  it('gives starters full games and leaves deep reserves off the field', () => {
    const minutes = getLacrosseParticipationMinutes(team);
    const values = [...minutes.values()];
    expect(values.filter((m) => m === 1).length).toBeGreaterThanOrEqual(6); // ATT x2, DEF x3, GK
    expect(minutes.size).toBeLessThan(team.roster.length);
    expect(values.every((m) => m >= 0 && m <= 1)).toBe(true);
  });
});

describe('rollLacrosseInjuries', () => {
  it('averages about three injuries per team over a 10-game season', () => {
    const perSeason = sample(2000, true).length / 200;
    expect(perSeason).toBeGreaterThan(2);
    expect(perSeason).toBeLessThan(4.5);
  });

  it('rarely injures a team on a bye', () => {
    expect(sample(2000, false).length / 200).toBeLessThan(1);
  });

  it('hurts players in proportion to their time on the field', () => {
    const minutes = getLacrosseParticipationMinutes(team);
    const injuries = sample(4000, true, 3);
    const starters = injuries.filter((i) => (minutes.get(i.playerId) ?? 0) >= 0.85).length;
    const benched = injuries.filter((i) => !minutes.has(i.playerId)).length;
    expect(starters).toBeGreaterThan(benched * 3);
  });

  it('assigns realistic durations, mostly short with a few season-enders', () => {
    const injuries = sample(4000, true, 5);
    const types = new Map(LACROSSE_INJURY_TYPES.map((t) => [t.description, t.weeks]));
    for (const injury of injuries) {
      const [min, max] = types.get(injury.description)!;
      expect(injury.weeksOut).toBeGreaterThanOrEqual(min);
      expect(injury.weeksOut).toBeLessThanOrEqual(max);
    }
    const short = injuries.filter((i) => i.weeksOut <= 2).length / injuries.length;
    const seasonEnding = injuries.filter((i) => i.weeksOut >= 10).length / injuries.length;
    expect(short).toBeGreaterThan(0.5);
    expect(seasonEnding).toBeGreaterThan(0);
    expect(seasonEnding).toBeLessThan(0.08);
  });

  it('skips players who are already hurt', () => {
    const skip = new Set(team.roster.map((p) => p.id));
    expect(rollLacrosseInjuries(team, { played: true, random: () => 0, skipPlayerIds: skip })).toEqual([]);
  });

  it('caps a full-time player at the game rate times proneness', () => {
    const always = rollLacrosseInjuries(team, { played: true, random: () => GAME_INJURY_RATE * 0.5 });
    // Everyone on the field for a full game is under the bar at half the base rate.
    const minutes = getLacrosseParticipationMinutes(team);
    const fullTimers = team.roster.filter((p) => minutes.get(p.id) === 1).map((p) => p.id);
    for (const id of fullTimers) expect(always.some((i) => i.playerId === id)).toBe(true);
  });
});

describe('lacrosseInjuryProneness', () => {
  it('makes durable players less injury-prone', () => {
    const [player] = team.roster;
    const fragile = { ...player!, ratings: { ...player!.ratings, stamina: 45, strength: 45 } };
    const sturdy = { ...player!, ratings: { ...player!.ratings, stamina: 92, strength: 90 } };
    expect(lacrosseInjuryProneness(fragile)).toBeGreaterThan(lacrosseInjuryProneness(sturdy));
    expect(lacrosseInjuryProneness(sturdy)).toBeGreaterThanOrEqual(0.6);
  });
});
