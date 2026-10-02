import { describe, expect, it } from 'vitest';
import { buildLacrosseLineup, getLacrosseParticipationMinutes, midfieldLineShares } from './lineups';
import type { LacrossePlayer } from './models';
import { generateLacrosseRoster } from './roster-generation';
import { makeLacrossePlayer, makeLacrosseTeam } from './test-fixtures';

const team = makeLacrosseTeam('u', generateLacrosseRoster({ seed: 4, prestige: 60, createdSeason: 2028 }));

describe('buildLacrosseLineup', () => {
  const lineup = buildLacrosseLineup(team);

  it('fills every unit from the depth chart in order', () => {
    expect(lineup.attack.map((p) => p.position)).toEqual(['ATT', 'ATT', 'ATT']);
    expect(lineup.closeDefense.map((p) => p.position)).toEqual(['DEF', 'DEF', 'DEF']);
    expect(lineup.goalie?.position).toBe('GK');
    expect(lineup.longStickMid?.position).toBe('LSM');
    expect(lineup.faceoff[0]?.position).toBe('FOGO');
    expect(lineup.midfieldLines.length).toBe(3);
    for (const line of lineup.midfieldLines) expect(line.length).toBe(3);
    const mids = team.roster.filter((p) => p.position === 'MID').sort((a, b) => b.ratings.overall - a.ratings.overall);
    expect(lineup.midfieldLines[0]!.map((p) => p.id)).toEqual(mids.slice(0, 3).map((p) => p.id));
  });

  it('builds a six-man man-up unit and a five-man man-down unit with no repeats', () => {
    expect(lineup.manUp.length).toBe(6);
    expect(new Set(lineup.manUp.map((p) => p.id)).size).toBe(6);
    expect(lineup.manDown.length).toBe(5);
    expect(new Set(lineup.manDown.map((p) => p.id)).size).toBe(5);
    expect(lineup.manDown.filter((p) => p.position === 'DEF').length).toBe(3);
  });

  it('follows a custom depth chart', () => {
    const attackers = team.roster.filter((p) => p.position === 'ATT');
    const benched = attackers[attackers.length - 1]!;
    const custom = { ...team, depthChart: { ATT: [benched.id] } };
    expect(buildLacrosseLineup(custom).attack[0]!.id).toBe(benched.id);
  });

  it('fills short positions from the rest of the roster', () => {
    const noAttack = makeLacrosseTeam('x', team.roster.filter((p) => p.position !== 'ATT' && p.position !== 'FOGO'));
    const built = buildLacrosseLineup(noAttack);
    expect(built.attack.length).toBe(3);
    expect(built.faceoff.length).toBe(1);
    expect(built.midfieldLines.length).toBeGreaterThan(0);
  });

  it('copes with a roster that is nearly all midfielders', () => {
    const built = buildLacrosseLineup(makeLacrosseTeam('mids'));
    expect(built.attack.length).toBe(3);
    expect(built.closeDefense.length).toBe(3);
    expect(built.goalie).not.toBeNull();
    expect(built.midfieldLines.length).toBe(3);
    const ids = new Set([...built.attack, ...built.closeDefense, ...built.midfieldLines.flat()].map((p) => p.id));
    expect(ids.size).toBe(3 + 3 + 9);
  });

  it('handles an empty roster', () => {
    const built = buildLacrosseLineup(makeLacrosseTeam('empty', []));
    expect(built.attack).toEqual([]);
    expect(built.midfieldLines).toEqual([]);
    expect(built.goalie).toBeNull();
  });
});

describe('midfieldLineShares', () => {
  it('renormalizes when a team only dresses two lines', () => {
    const shares = midfieldLineShares(2, 'tight');
    expect(shares.length).toBe(2);
    expect(shares.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 6);
    expect(shares[0]).toBeGreaterThan(shares[1]!);
  });
});

describe('getLacrosseParticipationMinutes', () => {
  it('plays starters the most and leaves deep reserves on the bench', () => {
    const minutes = getLacrosseParticipationMinutes(team);
    const starters = buildLacrosseLineup(team);
    for (const p of [...starters.attack, ...starters.closeDefense]) expect(minutes.get(p.id)).toBeGreaterThanOrEqual(0.95);
    expect(minutes.get(starters.goalie!.id)).toBe(1);
    const goalies = team.roster.filter((p) => p.position === 'GK');
    expect(minutes.get(goalies[goalies.length - 1]!.id)).toBeUndefined();
    for (const share of minutes.values()) {
      expect(share).toBeGreaterThan(0);
      expect(share).toBeLessThanOrEqual(1);
    }
  });

  it('gives the first midfield line more time under a tight rotation than a deep one', () => {
    const line1 = buildLacrosseLineup(team).midfieldLines[0]![0]!;
    expect(getLacrosseParticipationMinutes(team, { rotation: 'tight' }).get(line1.id)!).toBeGreaterThan(
      getLacrosseParticipationMinutes(team, { rotation: 'deep' }).get(line1.id)!,
    );
  });

  it('counts a two-way player once, capped at a full game', () => {
    const roster: LacrossePlayer[] = [makeLacrossePlayer(0, 'GK'), makeLacrossePlayer(1, 'ATT'), makeLacrossePlayer(2, 'DEF')];
    const minutes = getLacrosseParticipationMinutes(makeLacrosseTeam('tiny', roster));
    for (const share of minutes.values()) expect(share).toBeLessThanOrEqual(1);
  });
});

describe('depth chart integrity', () => {
  it('ignores a saved chart that lists a player under a position he does not play', () => {
    const midfielder = team.roster.find((p) => p.position === 'MID')!;
    const stale = { ...team, depthChart: { ATT: [midfielder.id] } };
    expect(buildLacrosseLineup(stale).attack.map((p) => p.id)).not.toContain(midfielder.id);
  });
});
