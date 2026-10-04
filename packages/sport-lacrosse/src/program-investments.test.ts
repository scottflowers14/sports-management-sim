import { describe, expect, it } from 'vitest';
import {
  ageProgram,
  applyInvestmentPlan,
  cpuInvestmentPlan,
  fanHomeEdgeFactor,
  fundProject,
  investmentBudget,
  investmentSummary,
  planCost,
  unfundProject,
} from './program-investments';
import type { LacrosseTeam } from './models';
import { makeLacrosseTeam } from './test-fixtures';

function program(overrides: Partial<LacrosseTeam['reputation']>): LacrosseTeam {
  const base = makeLacrosseTeam('alpha', []);
  return { ...base, reputation: { ...base.reputation, ...overrides } };
}

describe('investmentBudget', () => {
  it('gives bigger, louder programs more to spend', () => {
    expect(investmentBudget(program({ nationalPrestige: 80, fanSupport: 75 }))).toBe(10);
    expect(investmentBudget(program({ nationalPrestige: 50, fanSupport: 50 }))).toBe(8);
  });
});

describe('funding projects', () => {
  it('spends points until the budget runs out', () => {
    let plan = fundProject({}, 'facilities', 7);
    plan = fundProject(plan, 'facilities', 7);
    expect(plan).toEqual({ facilities: 2 });
    expect(planCost(plan)).toBe(6);
    // A third facility round (3 more points) doesn't fit; fan engagement (2) doesn't either.
    expect(fundProject(plan, 'facilities', 7)).toBe(plan);
    expect(fundProject(plan, 'fans', 7)).toBe(plan);
    expect(fundProject(plan, 'fans', 8)).toEqual({ facilities: 2, fans: 1 });
  });

  it('takes a round back off', () => {
    expect(unfundProject({ facilities: 2 }, 'facilities')).toEqual({ facilities: 1 });
    expect(unfundProject({ facilities: 1, fans: 1 }, 'facilities')).toEqual({ fans: 1 });
    const empty = {};
    expect(unfundProject(empty, 'fans')).toBe(empty);
  });

  it('raises each rating by its project, up to a cap', () => {
    const team = applyInvestmentPlan(program({ facilities: 70, fanSupport: 97, academicPrestige: 60 }), { facilities: 2, fans: 1, academics: 1 });
    expect(team.reputation).toMatchObject({ facilities: 76, fanSupport: 99, academicPrestige: 62 });
    expect(applyInvestmentPlan(program({ fanSupport: 60 }), { fans: 2 }).reputation.fanSupport).toBe(64);
  });

  it('summarizes what changed', () => {
    const before = program({ facilities: 70, fanSupport: 63 });
    expect(investmentSummary(before, applyInvestmentPlan(before, { facilities: 2, fans: 1 }))).toBe('facilities 70 to 76, fan support 63 to 65');
  });
});

describe('ageProgram', () => {
  it('wears facilities down and moves fans toward recent success', () => {
    const aged = ageProgram(program({ facilities: 70, fanSupport: 60, recentSuccess: 90 }));
    expect(aged.reputation).toMatchObject({ facilities: 69, fanSupport: 63 });
    expect(ageProgram(program({ fanSupport: 80, recentSuccess: 40 })).reputation.fanSupport).toBe(76);
  });
});

describe('cpuInvestmentPlan', () => {
  it('keeps facilities, then fans, up with the program and banks the rest', () => {
    const plan = cpuInvestmentPlan(program({ nationalPrestige: 80, fanSupport: 75, facilities: 75 }));
    // Facilities 75 to 81 (6 points), then fans 75 to 79 (4 points): the whole budget.
    expect(plan).toEqual({ facilities: 2, fans: 2 });
    expect(planCost(plan)).toBeLessThanOrEqual(10);
    expect(cpuInvestmentPlan(program({ nationalPrestige: 60, fanSupport: 57, facilities: 80 }))).toEqual({ fans: 2 });
    expect(cpuInvestmentPlan(program({ nationalPrestige: 60, fanSupport: 70, facilities: 80 }))).toEqual({});
  });
});

describe('fanHomeEdgeFactor', () => {
  it('scales the home edge with the crowd, within limits', () => {
    expect(fanHomeEdgeFactor(63)).toBe(1);
    expect(fanHomeEdgeFactor(88)).toBeCloseTo(1.25);
    expect(fanHomeEdgeFactor(43)).toBeCloseTo(0.8);
    expect(fanHomeEdgeFactor(0)).toBe(0.65);
    expect(fanHomeEdgeFactor(100)).toBe(1.35);
  });
});
