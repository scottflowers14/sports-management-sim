import { describe, expect, it } from 'vitest';
import { decidePortalEntry, portalMoraleMultiplier } from '@sports-management-sim/engine-core';
import type { LacrossePlayer, LacrosseTeam } from './models';
import {
  boostMorale,
  MORALE_BASELINE,
  moodLabel,
  moraleDevelopmentMultiplier,
  moraleReason,
  playerRoleStatus,
  runMoraleWeek,
  teamChemistry,
  weeklyMoraleChange,
} from './morale';
import { weeklyPracticeProgress } from './practice';
import { makeLacrossePlayer, makeLacrosseTeam } from './test-fixtures';

/** Three attackmen rated 80, 70, 60 plus one reserve at 50. */
function attackUnit(): LacrossePlayer[] {
  return [80, 70, 60, 50].map((overall, i) => {
    const p = makeLacrossePlayer(i, 'ATT');
    return { ...p, classYear: 'JR', morale: MORALE_BASELINE, ratings: { ...p.ratings, overall, potential: 90 } };
  });
}

function withDepthChart(roster: LacrossePlayer[], attOrder: string[]): LacrosseTeam {
  return { ...makeLacrosseTeam('durham', roster), depthChart: { ATT: attOrder } } as LacrosseTeam;
}

describe('player roles', () => {
  it('compares the depth chart spot with the spot his rating earns', () => {
    const roster = attackUnit();
    const fair = withDepthChart(roster, roster.map((p) => p.id));
    expect(playerRoleStatus(fair, roster[0]!)).toEqual({ expected: 'starter', actual: 'starter' });

    // Bench the best attackman behind the reserve.
    const benched = withDepthChart(roster, [roster[1]!.id, roster[2]!.id, roster[3]!.id, roster[0]!.id]);
    expect(playerRoleStatus(benched, roster[0]!)).toEqual({ expected: 'starter', actual: 'rotation' });
    expect(moraleReason(benched, roster[0]!)).toBe('Thinks he should be starting');
    expect(moraleReason(benched, roster[3]!)).toBe('Happy starting');
  });
});

describe('weekly morale', () => {
  const player = attackUnit()[0]!;
  const starting = { expected: 'starter', actual: 'starter' } as const;
  const benched = { expected: 'starter', actual: 'rotation' } as const;
  const normal = { won: null, intensity: 'normal' } as const;

  it('rewards starting and winning, punishes benching, losing and hard practice', () => {
    expect(weeklyMoraleChange(player, starting, normal)).toBeGreaterThan(0);
    expect(weeklyMoraleChange(player, benched, normal)).toBeLessThan(-2);
    expect(weeklyMoraleChange(player, starting, { ...normal, won: true })).toBeGreaterThan(
      weeklyMoraleChange(player, starting, { ...normal, won: false }),
    );
    expect(weeklyMoraleChange(player, starting, { ...normal, intensity: 'intense' })).toBeLessThan(
      weeklyMoraleChange(player, starting, { ...normal, intensity: 'light' }),
    );
  });

  it('hits a benched senior harder than a benched sophomore', () => {
    const senior = { ...player, classYear: 'SR' as const };
    const sophomore = { ...player, classYear: 'SO' as const };
    expect(weeklyMoraleChange(senior, benched, normal)).toBeLessThan(weeklyMoraleChange(sophomore, benched, normal));
  });

  it('lets a benched star sour over a few weeks while a fair depth chart stays content', () => {
    const roster = attackUnit();
    let fair = withDepthChart(roster, roster.map((p) => p.id));
    let benchedTeam = withDepthChart(roster, [roster[1]!.id, roster[2]!.id, roster[3]!.id, roster[0]!.id]);
    for (let week = 0; week < 6; week += 1) {
      fair = runMoraleWeek(fair, { won: false, intensity: 'normal' }).team;
      benchedTeam = runMoraleWeek(benchedTeam, { won: false, intensity: 'normal' }).team;
    }
    const star = (team: LacrosseTeam) => team.roster.find((p) => p.id === roster[0]!.id)!.morale;
    expect(star(benchedTeam)).toBeLessThan(50);
    expect(star(fair)).toBeGreaterThanOrEqual(55);
  });

  it('settles toward the baseline instead of running away', () => {
    const roster = attackUnit().map((p) => ({ ...p, morale: 99 }));
    let team = withDepthChart(roster, roster.map((p) => p.id));
    for (let week = 0; week < 40; week += 1) team = runMoraleWeek(team, { won: null, intensity: 'normal' }).team;
    for (const p of team.roster) expect(Math.abs(p.morale - MORALE_BASELINE)).toBeLessThan(25);
  });

  it('reports only the players whose morale moved', () => {
    const roster = attackUnit();
    const team = withDepthChart(roster, roster.map((p) => p.id));
    const { changes } = runMoraleWeek(team, { won: true, intensity: 'normal' });
    expect(changes.length).toBeGreaterThan(0);
    for (const c of changes) expect(c.to).not.toBe(c.from);
  });
});

describe('talks, meetings and chemistry', () => {
  it('lifts the chosen players, capped at 99', () => {
    const roster = attackUnit();
    const team = withDepthChart(roster, roster.map((p) => p.id));
    const talked = boostMorale(team, new Set([roster[0]!.id]), 10);
    expect(talked.roster[0]!.morale).toBe(MORALE_BASELINE + 10);
    expect(talked.roster[1]!.morale).toBe(MORALE_BASELINE);
    const meeting = boostMorale({ ...team, roster: team.roster.map((p) => ({ ...p, morale: 97 })) }, 'all', 4);
    expect(meeting.roster.every((p) => p.morale === 99)).toBe(true);
    expect(teamChemistry(meeting)).toBe(99);
  });

  it('labels moods', () => {
    expect([90, 75, 60, 40, 20].map(moodLabel)).toEqual(['Delighted', 'Happy', 'Content', 'Unhappy', 'Furious']);
  });
});

describe('what morale changes', () => {
  it('speeds up practice for happy players and slows it for unhappy ones', () => {
    const base = makeLacrossePlayer(1, 'MID');
    const options = { intensity: 'normal' as const, hasPlan: false, developmentRating: 65, minutesShare: 0 };
    const happy = weeklyPracticeProgress({ ...base, morale: 90 }, options);
    const unhappy = weeklyPracticeProgress({ ...base, morale: 20 }, options);
    expect(happy).toBeGreaterThan(unhappy * 1.2);
    expect(moraleDevelopmentMultiplier(50)).toBeCloseTo(1);
  });

  it('sends unhappy players to the portal more often', () => {
    expect(portalMoraleMultiplier(20)).toBeGreaterThan(portalMoraleMultiplier(45));
    expect(portalMoraleMultiplier(45)).toBeGreaterThan(portalMoraleMultiplier(65));
    expect(portalMoraleMultiplier(90)).toBeLessThan(1);

    // Same buried junior, same dice: only morale differs.
    const roster = attackUnit();
    const team = withDepthChart(roster, roster.map((p) => p.id));
    const entrants = (morale: number) => {
      let count = 0;
      for (let i = 0; i < 1000; i += 1) {
        const roll = (i + 0.5) / 1000;
        const decision = decidePortalEntry({ ...roster[3]!, morale }, team, { depthRank: 7, starters: 3, random: () => roll });
        if (decision) count += 1;
      }
      return count;
    };
    expect(entrants(25)).toBeGreaterThan(entrants(65) * 1.8);
    expect(entrants(90)).toBeLessThan(entrants(65));
  });
});
