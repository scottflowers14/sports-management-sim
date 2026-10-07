import { describe, expect, it } from 'vitest';
import { offseasonTodos, spendableInvestmentPoints, startSeasonWarning } from './offseason-todo';

const base = { investmentBudget: 9, investmentPlan: {}, portalAvailable: 0, portalOffers: 0, scholarshipRoom: 1, vacantStaffRoles: [], realignmentPending: false };

describe('offseason to-do', () => {
  it('counts only investment points that can still buy something', () => {
    expect(spendableInvestmentPoints(9, {})).toBe(9);
    // 4 + 3 = 7 spent: the 2 left still buy a round of fan engagement.
    expect(spendableInvestmentPoints(9, { academics: 1, facilities: 1 })).toBe(2);
    // 1 point left buys nothing.
    expect(spendableInvestmentPoints(9, { academics: 2 })).toBe(0);
  });

  it('lists investments, staff, portal and the invite with their state', () => {
    const todos = offseasonTodos({ ...base, portalAvailable: 40, vacantStaffRoles: ['recruiting coordinator'], realignmentPending: true });
    expect(todos.map((t) => t.id)).toEqual(['realignment', 'investments', 'staff', 'portal']);
    expect(todos.find((t) => t.id === 'investments')).toMatchObject({ done: false, status: '0 of 9 spent · 9 left, lost if unspent' });
    expect(todos.find((t) => t.id === 'portal')).toMatchObject({ done: false, optional: true });
    const settled = offseasonTodos({ ...base, investmentPlan: { academics: 2 }, portalAvailable: 40, portalOffers: 2 });
    expect(settled.every((t) => t.done)).toBe(true);
  });

  it('warns before starting the season only when something would be lost', () => {
    const open = offseasonTodos({ ...base, vacantStaffRoles: ['defensive coordinator'] });
    expect(startSeasonWarning(open, 9)).toMatch(/9 investment points.*staff chair is empty/);
    expect(startSeasonWarning(offseasonTodos({ ...base, portalAvailable: 10 }), 0)).toBeNull();
  });
});
