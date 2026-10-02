import { describe, expect, it } from 'vitest';
import { generateLacrosseRoster } from './roster-generation';
import { simulateLacrosseGame } from './simulate-game';
import {
  advanceStaffContracts,
  coachingEdge,
  cpuStaffRating,
  developmentBonusFor,
  generateStaffCandidates,
  fillStaffVacancies,
  generateStartingStaff,
  hireStaffCandidate,
  programCoachingEdge,
  programStaffRating,
  releaseStaffMember,
  runStaffOffseason,
  recruitingHoursFor,
  staffBudgetFor,
  staffPayroll,
  staffRating,
  staffSalary,
  STAFF_ROLES,
  VACANT_STAFF_RATING,
} from './staff';
import { makeLacrosseTeam } from './test-fixtures';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const team = makeLacrosseTeam('durham', generateLacrosseRoster({ seed: 3, prestige: 70, createdSeason: 2028 }));

describe('staff economics', () => {
  it('pays better coaches more and gives bigger programs bigger budgets', () => {
    expect(staffSalary(90)).toBeGreaterThan(staffSalary(70));
    expect(staffSalary(70)).toBe(110_000);
    expect(staffBudgetFor(85)).toBeGreaterThan(staffBudgetFor(50));
  });

  it('builds a starting staff that fills every role and roughly fits the budget', () => {
    const staff = generateStartingStaff(team, 7);
    for (const role of STAFF_ROLES) expect(staff[role]?.role).toBe(role);
    expect(staffPayroll(staff)).toBeLessThanOrEqual(staffBudgetFor(team.reputation.nationalPrestige) * 1.1);
  });

  it('offers candidates for every role, rated better at prestigious programs', () => {
    const avg = (prestige: number) => {
      const pool = generateStaffCandidates({ seed: 11, prestige, perRole: 20 });
      return pool.reduce((s, c) => s + c.rating, 0) / pool.length;
    };
    const pool = generateStaffCandidates({ seed: 11, prestige: 70 });
    expect(new Set(pool.map((c) => c.role))).toEqual(new Set(STAFF_ROLES));
    expect(pool.every((c) => c.rating >= 40 && c.rating <= 95 && c.salary === staffSalary(c.rating))).toBe(true);
    expect(avg(90)).toBeGreaterThan(avg(50) + 10);
  });

  it('runs contracts down and lets expiring coaches go', () => {
    const staff = generateStartingStaff(team, 7);
    const expiring = { ...staff, offense: { ...staff.offense!, yearsLeft: 1 } };
    const { staff: next, departed } = advanceStaffContracts(expiring);
    expect(departed.map((d) => d.role)).toEqual(['offense']);
    expect(next.offense).toBeUndefined();
    expect(next.defense?.yearsLeft).toBe(staff.defense!.yearsLeft - 1);
    expect(staffRating(next, 'offense')).toBe(VACANT_STAFF_RATING);
  });
});

describe('staff effects', () => {
  it('scales recruiting hours and development with the coach', () => {
    expect(recruitingHoursFor(65)).toBe(6);
    expect(recruitingHoursFor(95)).toBe(9);
    expect(recruitingHoursFor(40)).toBeLessThan(6);
    expect(developmentBonusFor(85)).toBeGreaterThan(0);
    expect(developmentBonusFor(45)).toBeLessThan(0);
  });

  it('derives stable CPU staff ratings from coaching prestige', () => {
    const elite = { ...team, reputation: { ...team.reputation, coachingPrestige: 90 } };
    const weak = { ...team, reputation: { ...team.reputation, coachingPrestige: 45 } };
    expect(cpuStaffRating(elite, 'offense')).toBe(cpuStaffRating(elite, 'offense'));
    expect(cpuStaffRating(elite, 'defense')).toBeGreaterThan(cpuStaffRating(weak, 'defense'));
  });

  it('gives a better coaching staff more wins between equal rosters', () => {
    const random = seededRandom(5);
    const away = makeLacrosseTeam('twin', team.roster);
    const great = coachingEdge(92, 92);
    const poor = coachingEdge(45, 45);
    let wins = 0;
    const games = 3000;
    for (let i = 0; i < games; i += 1) {
      const result = simulateLacrosseGame({ homeTeam: team, awayTeam: away, random, neutralSite: true, homeCoaching: great, awayCoaching: poor });
      if (result.winnerTeamId === team.id) wins += 1;
    }
    // Coaching matters, but it shouldn't outweigh talent: roughly a 60/40 edge.
    expect(wins / games).toBeGreaterThan(0.56);
    expect(wins / games).toBeLessThan(0.72);
  });
});

describe('hiring and the offseason cycle', () => {
  const pool = generateStaffCandidates({ seed: 11, prestige: 70 });
  const offense = pool.find((c) => c.role === 'offense')!;

  it('hires within budget and reports who was replaced', () => {
    const staff = generateStartingStaff(team, 7);
    const result = hireStaffCandidate(staff, offense, 10_000_000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.staff.offense).toEqual(offense);
    expect(result.replaced).toEqual(staff.offense);
  });

  it('refuses a hire that breaks the budget', () => {
    const staff = generateStartingStaff(team, 7);
    const tight = staffPayroll(staff) - staff.offense!.salary + offense.salary - 1;
    const result = hireStaffCandidate(staff, offense, tight);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/over the \$\d+k budget/);
  });

  it('releasing leaves the role vacant at the vacant rating', () => {
    const staff = releaseStaffMember(generateStartingStaff(team, 7), 'defense');
    expect(staff.defense).toBeUndefined();
    expect(staffRating(staff, 'defense')).toBe(VACANT_STAFF_RATING);
  });

  it('puts expiring coaches back in the pool asking for a raise', () => {
    const staff = generateStartingStaff(team, 7);
    const expiring = { ...staff.recruiting!, yearsLeft: 1 };
    const result = runStaffOffseason({ ...staff, recruiting: expiring }, { seed: 5, prestige: 70 });
    expect(result.staff.recruiting).toBeUndefined();
    expect(result.departed).toEqual([expiring]);
    const returning = result.candidates.find((c) => c.id === expiring.id)!;
    expect(returning.salary).toBeGreaterThan(expiring.salary);
    expect(result.candidates.length).toBe(1 + STAFF_ROLES.length * 3);
  });

  it('uses hired staff for the user team and the prestige estimate for everyone else', () => {
    const rival = makeLacrosseTeam('rival', team.roster);
    const staff = { offense: { ...offense, rating: 95 } };
    const user = { teamId: team.id, staff };
    expect(programStaffRating(team, 'offense', user)).toBe(95);
    expect(programStaffRating(rival, 'offense', user)).toBe(cpuStaffRating(rival, 'offense'));
    expect(programCoachingEdge(team, user).offense).toBeGreaterThan(0);
    expect(programStaffRating(team, 'offense', { teamId: team.id })).toBe(cpuStaffRating(team, 'offense'));
  });

  it('fills empty chairs with the best candidate the budget allows', () => {
    const staff = releaseStaffMember(releaseStaffMember(generateStartingStaff(team, 7), 'offense'), 'defense');
    const filled = fillStaffVacancies(staff, pool, 10_000_000);
    const best = pool.filter((c) => c.role === 'offense').sort((a, b) => b.rating - a.rating)[0]!;
    expect(filled.staff.offense).toEqual(best);
    expect(filled.staff.defense?.role).toBe('defense');
    expect(filled.hired).toHaveLength(2);
    expect(filled.candidates).toHaveLength(pool.length - 2);
    expect(filled.staff.recruiting).toEqual(staff.recruiting);
  });

  it('leaves a chair empty when nothing fits the budget', () => {
    const staff = releaseStaffMember(generateStartingStaff(team, 7), 'offense');
    const filled = fillStaffVacancies(staff, pool, staffPayroll(staff));
    expect(filled.staff.offense).toBeUndefined();
    expect(filled.hired).toEqual([]);
  });
});
