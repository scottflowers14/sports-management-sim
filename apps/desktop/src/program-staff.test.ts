import { afterEach, describe, expect, it, vi } from 'vitest';
import { recruitingHoursFor, STAFF_ROLES, type LacrosseStaff } from '@sports-management-sim/sport-lacrosse';
import { createFreshLacrosseDynasty } from './dynasty-factory';
import { runOffseason } from './dynasty-helpers';
import { createProgramStaff, describeStaffEffect, withStaffRecruitingHours } from './program-staff';
import { createScoutingState } from './scouting';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('program staff', () => {
  it('creates a full starting staff and a hiring pool for the user program', () => {
    const dynasty = createFreshLacrosseDynasty({ now: () => 12_000 });
    const { staff, staffCandidates } = createProgramStaff(dynasty);
    for (const role of STAFF_ROLES) expect(staff[role]?.role).toBe(role);
    for (const role of STAFF_ROLES) expect(staffCandidates.some((c) => c.role === role)).toBe(true);
  });

  it('sets weekly recruiting hours from the recruiting coordinator and caps the bank', () => {
    const scouting = { ...createScoutingState(), pointsAvailable: 30 };
    const weak = withStaffRecruitingHours(scouting, {});
    expect(weak.pointsPerWeek).toBe(recruitingHoursFor(45));
    expect(weak.pointsAvailable).toBe(weak.pointsPerWeek * 4);
    const staff = createProgramStaff(createFreshLacrosseDynasty({ now: () => 3_000 })).staff;
    expect(withStaffRecruitingHours(createScoutingState(), staff).pointsPerWeek).toBe(
      recruitingHoursFor(staff.recruiting!.rating),
    );
  });

  it('describes effects in plain units', () => {
    expect(describeStaffEffect('offense', 90)).toBe('+0.4 goals a game');
    expect(describeStaffEffect('defense', 90)).toBe('0.4 fewer goals allowed a game');
    expect(describeStaffEffect('defense', 45)).toBe('0.3 more goals allowed a game');
    expect(describeStaffEffect('recruiting', 85)).toBe('8 recruiting hours a week');
    expect(describeStaffEffect('development', 65)).toBe('±0% offseason growth');
    expect(describeStaffEffect('development', 95)).toBe('+10% offseason growth');
  });

  it('a great development coach grows the roster more than a vacant chair', () => {
    const gains = (staff: LacrosseStaff) => {
      // Offseason development rolls use Math.random; pin it so both runs see the same rolls.
      let state = 99;
      vi.spyOn(Math, 'random').mockImplementation(() => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
      });
      let total = 0;
      for (let seed = 1; seed <= 6; seed += 1) {
        const dynasty = createFreshLacrosseDynasty({ now: () => seed * 1_000 });
        const before = new Map(
          dynasty.season.teams.find((t) => t.id === dynasty.userTeamId)!.roster.map((p) => [p.id, p.ratings.overall]),
        );
        const { newDynasty } = runOffseason(dynasty, undefined, 'balanced', undefined, staff);
        const after = newDynasty.season.teams.find((t) => t.id === newDynasty.userTeamId)!.roster;
        for (const p of after) {
          const prev = before.get(p.id);
          if (prev !== undefined) total += p.ratings.overall - prev;
        }
      }
      vi.restoreAllMocks();
      return total;
    };
    const elite: LacrosseStaff = {
      development: { id: 'd', name: { first: 'A', last: 'B' }, role: 'development', rating: 95, salary: 0, yearsLeft: 3 },
    };
    expect(gains(elite)).toBeGreaterThan(gains({}));
  }, 30_000);
});
