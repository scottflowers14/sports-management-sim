import { describe, expect, it } from 'vitest';
import type { PositionNeed } from '@sports-management-sim/engine-core';
import { createFreshLacrosseDynasty } from '../dynasty-factory';
import { createScoutingState } from '../scouting';
import { computeActionItems } from './WeekHubScreen';
import { staffModeOf } from './RecruitingScreen';

function itemsWith(scholarshipBudgetLeft: number | undefined) {
  const dynasty = createFreshLacrosseDynasty({ now: () => 1_000 });
  const userTeam = dynasty.season.teams.find((t) => t.id === dynasty.userTeamId)!;
  const classNeeds: PositionNeed[] = [{ position: 'DEF', graduating: 3, returning: 7, committed: 0, open: 3, offersOut: 1 }];
  return computeActionItems({
    injuries: [],
    userTeam,
    scouting: createScoutingState(),
    recruitBoard: [],
    portalEntries: [],
    userTeamId: dynasty.userTeamId,
    seasonComplete: false,
    currentWeek: 5,
    classNeeds,
    ...(scholarshipBudgetLeft !== undefined ? { scholarshipBudgetLeft } : {}),
  });
}

describe('class-needs nudge', () => {
  it('asks for more offers while there is money to offer', () => {
    const item = itemsWith(1.5).find((i) => i.id === 'class-needs')!;
    expect(item.text).toMatch(/without enough offers out: DEF 3/);
    expect(item.priority).toBe('high');
  });

  it('says how to make room once the scholarship budget is spent', () => {
    const item = itemsWith(0).find((i) => i.id === 'class-needs')!;
    expect(item.text).toMatch(/budget is full.*DEF 3.*Drop a long-shot offer/);
    expect(item.priority).toBe('medium');
  });
});

describe('recruiting staff mode', () => {
  it('folds the two assistant switches into one setting', () => {
    expect(staffModeOf(false, false)).toBe('off');
    expect(staffModeOf(false, true)).toBe('off');
    expect(staffModeOf(true, false)).toBe('pitch');
    expect(staffModeOf(true, true)).toBe('full');
  });
});
