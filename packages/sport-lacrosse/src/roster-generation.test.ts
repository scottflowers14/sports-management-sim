import { describe, expect, it } from 'vitest';
import { validateCustomTeamsFile } from './dynasty';
import type { LacrossePosition } from './models';
import {
  buildRosterFromCustomPlayers,
  generateLacrosseRoster,
  rosterScholarshipsUsed,
  type CustomPlayerDefinition,
} from './roster-generation';
import { validateLacrosseRoster } from './roster-validation';
import { makeLacrosseTeam } from './test-fixtures';

describe('generateLacrosseRoster', () => {
  const roster = generateLacrosseRoster({ seed: 42, prestige: 70, createdSeason: 2028 });

  it('produces a legal roster that passes lacrosse roster validation', () => {
    const team = makeLacrosseTeam('gen-team', roster);
    team.resources = { ...team.resources, scholarshipUsed: rosterScholarshipsUsed(roster) };
    const result = validateLacrosseRoster(team);
    expect(result.ok).toBe(true);
  });

  it('fills every position group', () => {
    const counts = new Map<string, number>();
    for (const p of roster) counts.set(p.position, (counts.get(p.position) ?? 0) + 1);
    for (const pos of ['ATT', 'MID', 'DEF', 'LSM', 'GK', 'FOGO'] as LacrossePosition[]) {
      expect(counts.get(pos) ?? 0).toBeGreaterThanOrEqual(2);
    }
    expect(roster.length).toBeLessThanOrEqual(45);
  });

  it('spreads players across class years', () => {
    const classes = new Set(roster.map((p) => p.classYear));
    expect(classes).toContain('FR');
    expect(classes).toContain('SO');
    expect(classes).toContain('JR');
    expect(classes).toContain('SR');
  });

  it('keeps scholarships within the 12.6 limit', () => {
    expect(rosterScholarshipsUsed(roster)).toBeLessThanOrEqual(12.6);
    expect(rosterScholarshipsUsed(roster)).toBeGreaterThan(8);
  });

  it('gives high-prestige programs meaningfully better talent', () => {
    const elite = generateLacrosseRoster({ seed: 7, prestige: 90, createdSeason: 2028 });
    const modest = generateLacrosseRoster({ seed: 7, prestige: 45, createdSeason: 2028 });
    const avg = (rs: typeof elite) => rs.reduce((s, p) => s + p.ratings.overall, 0) / rs.length;
    expect(avg(elite) - avg(modest)).toBeGreaterThan(8);
  });

  it('creates varied players rather than clones', () => {
    const overalls = new Set(roster.map((p) => p.ratings.overall));
    const names = new Set(roster.map((p) => `${p.name.first} ${p.name.last}`));
    expect(overalls.size).toBeGreaterThan(8);
    expect(names.size).toBeGreaterThan(20);
  });

  it('is deterministic for the same seed', () => {
    const again = generateLacrosseRoster({ seed: 42, prestige: 70, createdSeason: 2028 });
    expect(again).toEqual(roster);
  });
});

describe('buildRosterFromCustomPlayers', () => {
  const defs: CustomPlayerDefinition[] = [
    { firstName: 'Pat', lastName: 'Spencer', position: 'ATT', classYear: 'SR', overall: 92 },
    { firstName: 'Mike', lastName: 'Sowers', position: 'ATT', classYear: 'JR', overall: 88, potential: 95 },
    { firstName: 'Tres', lastName: 'Keeper', position: 'GK', classYear: 'SO', overall: 80 },
    { firstName: 'Bo', lastName: 'Faceman', position: 'FOGO', classYear: 'FR', overall: 75 },
  ];

  it('builds full players from minimal definitions', () => {
    const players = buildRosterFromCustomPlayers(defs, { seed: 5, createdSeason: 2028 });

    expect(players).toHaveLength(4);
    expect(players[0]!.name).toEqual({ first: 'Pat', last: 'Spencer' });
    expect(players[0]!.ratings.overall).toBe(92);
    expect(players[1]!.ratings.potential).toBe(95);
    // FR with no explicit potential gets development headroom
    expect(players[3]!.ratings.potential).toBeGreaterThan(75);
    // Goalie gets goalie traits
    expect(players[2]!.sportTraits.goalieReflexes).toBeDefined();
    // Best players carry scholarships
    expect(players[0]!.scholarshipPercent).toBeGreaterThan(0);
  });
});

describe('validateCustomTeamsFile with rosters', () => {
  function baseFile() {
    const teams = ['a', 'b', 'c', 'd'].map((id) => ({
      id,
      name: `Team ${id}`,
      conferenceId: 'conf',
      regionId: 'mid-atlantic',
      nationalPrestige: 60,
      academicPrestige: 60,
      coachingPrestige: 60,
      facilities: 60,
      fanSupport: 60,
      recentSuccess: 60,
    }));
    return {
      version: 1,
      teams,
      conferences: [{ id: 'conf', name: 'Conference', shortName: 'CONF', prestige: 60 }],
    };
  }

  function makeRosterDefs(count: number): CustomPlayerDefinition[] {
    return Array.from({ length: count }, (_, i) => ({
      firstName: 'P',
      lastName: `${i}`,
      position: (i === 0 ? 'GK' : i === 1 ? 'FOGO' : 'MID') as LacrossePosition,
      classYear: 'SO' as const,
      overall: 60,
    }));
  }

  it('accepts a file where some teams have custom rosters', () => {
    const file = baseFile();
    (file.teams[0] as { roster?: CustomPlayerDefinition[] }).roster = makeRosterDefs(15);
    const result = validateCustomTeamsFile(file);
    expect(result.ok).toBe(true);
  });

  it('rejects rosters that are too small, lack a GK, or have bad ratings', () => {
    const tooSmall = baseFile();
    (tooSmall.teams[0] as { roster?: unknown }).roster = makeRosterDefs(5);
    expect(validateCustomTeamsFile(tooSmall).ok).toBe(false);

    const noGk = baseFile();
    (noGk.teams[0] as { roster?: unknown }).roster = makeRosterDefs(15).map((p) => ({
      ...p,
      position: 'MID' as LacrossePosition,
    }));
    expect(validateCustomTeamsFile(noGk).ok).toBe(false);

    const badOverall = baseFile();
    const defs = makeRosterDefs(15);
    defs[3] = { ...defs[3]!, overall: 250 };
    (badOverall.teams[0] as { roster?: unknown }).roster = defs;
    const result = validateCustomTeamsFile(badOverall);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toMatchObject({ type: 'invalid_roster', teamId: 'a' });
    }
  });
});
