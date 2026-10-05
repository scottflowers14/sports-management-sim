import { describe, expect, it } from 'vitest';
import { recruitingHoursFor, staffRating, VACANT_STAFF_RATING } from '@sports-management-sim/sport-lacrosse';
import type { LacrosseStaff, StaffMember } from '@sports-management-sim/sport-lacrosse';
import {
  addCoachXp,
  availablePoints,
  canUpgrade,
  seasonCoachXp,
  spentPoints,
  upgradeAbility,
  withCoachAbilities,
  xpToNextPoint,
} from './coach-abilities';

function member(role: StaffMember['role'], rating: number): StaffMember {
  return { id: `s-${role}`, name: { first: 'A', last: 'B' }, role, rating, salary: 100_000, yearsLeft: 2 };
}

describe('seasonCoachXp', () => {
  it('itemizes a season', () => {
    const award = seasonCoachXp({
      year: 2030,
      wins: 12,
      confChampion: true,
      nationalChampion: false,
      coachOfYear: true,
      goalsMet: 3,
      proPicks: 2,
      firstRoundPicks: 1,
    });
    expect(award.lines).toEqual([
      { label: '12 wins', xp: 180 },
      { label: '3 season goals met', xp: 60 },
      { label: 'Conference title', xp: 50 },
      { label: 'Coach of the Year', xp: 50 },
      { label: '2 pro draft picks', xp: 30 },
    ]);
    expect(award.total).toBe(370);
  });

  it('leaves out what did not happen', () => {
    const award = seasonCoachXp({ year: 2030, wins: 1, confChampion: false, nationalChampion: false, coachOfYear: false, goalsMet: 0, proPicks: 0, firstRoundPicks: 0 });
    expect(award).toEqual({ year: 2030, total: 15, lines: [{ label: '1 win', xp: 15 }] });
  });
});

describe('ability points', () => {
  it('starts a new coach with one point, and tiers cost more as they climb', () => {
    let coach: { xp?: number; abilities?: Record<string, number> } = {};
    expect(availablePoints(coach)).toBe(1);
    coach = upgradeAbility(coach, 'recruiter');
    expect(coach.abilities).toEqual({ recruiter: 1 });
    expect(availablePoints(coach)).toBe(0);
    // Tier 2 costs 2 points: one more season's worth isn't enough.
    coach = addCoachXp(coach, 150);
    expect(canUpgrade(coach, 'recruiter')).toBe(false);
    expect(canUpgrade(coach, 'developer')).toBe(true);
    coach = addCoachXp(coach, 150);
    coach = upgradeAbility(coach, 'recruiter');
    expect(coach.abilities).toEqual({ recruiter: 2 });
    expect(spentPoints(coach.abilities)).toBe(3);
    expect(availablePoints(coach)).toBe(0);
  });

  it('caps a track at tier 3', () => {
    const maxed = { xp: 150 * 20, abilities: { playCaller: 3 } };
    expect(canUpgrade(maxed, 'playCaller')).toBe(false);
    expect(upgradeAbility(maxed, 'playCaller')).toBe(maxed);
  });

  it('counts down to the next point', () => {
    expect(xpToNextPoint({ xp: 200 })).toBe(100);
    expect(xpToNextPoint({})).toBe(150);
  });
});

describe('withCoachAbilities', () => {
  it('plays each staff role five points better per tier', () => {
    const staff: LacrosseStaff = { offense: member('offense', 70), recruiting: member('recruiting', 96) };
    const effective = withCoachAbilities(staff, { playCaller: 2, recruiter: 1, defensiveMind: 1 });
    expect(staffRating(effective, 'offense')).toBe(80);
    expect(staffRating(effective, 'recruiting')).toBe(99);
    // A vacant chair is a graduate assistant, lifted by the head coach.
    expect(staffRating(effective, 'defense')).toBe(VACANT_STAFF_RATING + 5);
    expect(staffRating(effective, 'development')).toBe(VACANT_STAFF_RATING);
    // The hired staff itself is untouched.
    expect(staff.offense!.rating).toBe(70);
    expect(staff.defense).toBeUndefined();
  });

  it('adds recruiting hours', () => {
    const staff: LacrosseStaff = { recruiting: member('recruiting', 65) };
    expect(recruitingHoursFor(staffRating(withCoachAbilities(staff, { recruiter: 3 }), 'recruiting'))).toBe(
      recruitingHoursFor(65) + 2,
    );
  });
});
