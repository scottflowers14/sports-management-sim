import { describe, expect, it } from 'vitest';
import { suggestedScholarshipPercent, suggestScholarshipOffers } from './offer-suggestions';
import { sortRecruitBoardForTeam } from './recruit-board';
import type { Recruit } from './recruiting';
import { makePlayer, makeRecruit, makeTeam } from './test-fixtures';

type Pos = 'ATT' | 'MID' | 'DEF' | 'GK' | 'FOGO';
const TARGETS = { ATT: 3, MID: 4, DEF: 3, GK: 2, FOGO: 1 };

/** A team losing two senior attackmen and one senior goalie. */
function graduatingTeam() {
  const team = makeTeam();
  const senior = (id: string, position: Pos) => ({ ...makePlayer(id, position), classYear: 'SR' as const });
  return { ...team, roster: [...team.roster, senior('a-sr1', 'ATT'), senior('a-sr2', 'ATT'), senior('g-sr', 'GK')] };
}

function star(recruit: Recruit<Pos>, starRating: Recruit<Pos>['starRating']): Recruit<Pos> {
  return { ...recruit, starRating };
}

function suggest(recruits: Recruit<Pos>[], opts: { budget?: number; known?: (id: string) => boolean; team?: ReturnType<typeof makeTeam> } = {}) {
  const team = opts.team ?? graduatingTeam();
  return suggestScholarshipOffers({
    team,
    board: sortRecruitBoardForTeam(team, recruits, TARGETS),
    budgetRemaining: opts.budget ?? 3.25,
    isKnown: opts.known ?? (() => true),
  });
}

describe('suggestScholarshipOffers', () => {
  it('replaces graduates by position, about 1.5 offers per spot', () => {
    const recruits = [
      ...Array.from({ length: 6 }, (_, i) => makeRecruit(`att-${i}`, 'ATT', 70 - i)),
      ...Array.from({ length: 4 }, (_, i) => makeRecruit(`gk-${i}`, 'GK', 68 - i)),
      ...Array.from({ length: 4 }, (_, i) => makeRecruit(`mid-${i}`, 'MID', 75 - i)),
    ];
    const byPosition = (pos: string) => suggest(recruits).filter((s) => s.position === pos).length;
    expect(byPosition('ATT')).toBe(3); // ceil(2 * 1.5)
    expect(byPosition('GK')).toBe(2); // ceil(1 * 1.5)
    expect(byPosition('MID')).toBe(0); // nobody graduating
  });

  it('counts commitments and outstanding offers against open spots', () => {
    const committed = { ...makeRecruit('att-pledge', 'ATT', 70), status: 'committed' as const, committedTeamId: 'team-1' };
    const offered = { ...makeRecruit('att-offered', 'ATT', 69), scholarshipOffers: [{ teamId: 'team-1', scholarshipPercent: 50 }] };
    const fresh = Array.from({ length: 4 }, (_, i) => makeRecruit(`att-${i}`, 'ATT', 65 - i));
    // One spot left after the pledge -> ceil(1.5) = 2 offers, one already out.
    const atts = suggest([committed, offered, ...fresh]).filter((s) => s.position === 'ATT');
    expect(atts.map((s) => s.recruitId)).toEqual(['att-0']);
  });

  it('stays inside the class budget and sizes offers by star rating', () => {
    const recruits = [
      star(makeRecruit('att-5', 'ATT', 80), 5),
      star(makeRecruit('att-4', 'ATT', 74), 4),
      star(makeRecruit('gk-3', 'GK', 70), 3),
      star(makeRecruit('gk-2', 'GK', 62), 2),
    ];
    const plan = suggest(recruits, { budget: 1.2 });
    const spent = plan.reduce((sum, s) => sum + s.scholarshipPercent / 100, 0);
    expect(spent).toBeLessThanOrEqual(1.2);
    expect(plan.find((s) => s.recruitId === 'att-5')?.scholarshipPercent).toBe(75);
    expect(suggestedScholarshipPercent(4)).toBe(50);
    expect(suggest(recruits, { budget: 0.1 })).toEqual([]);
  });

  it('skips unscouted recruits, long shots and anyone not open', () => {
    const lowPrestige = { ...graduatingTeam(), reputation: { ...makeTeam().reputation, nationalPrestige: 35 } };
    const longShot = star(makeRecruit('att-5', 'ATT', 85), 5);
    const realistic = star(makeRecruit('att-2', 'ATT', 60), 2);
    const signedElsewhere = { ...makeRecruit('att-gone', 'ATT', 75), status: 'signed' as const, signedTeamId: 'rival' };
    const unknown = makeRecruit('att-unknown', 'ATT', 72);
    const plan = suggest([longShot, realistic, signedElsewhere, unknown], {
      team: lowPrestige,
      known: (id) => id !== 'att-unknown',
    });
    expect(plan.map((s) => s.recruitId)).toEqual(['att-2']);
  });

  // Playtest: the planner spent 3.08 of 3.25 on five-star attackers and
  // midfielders and left the open goalie spot with no offer at all.
  it('covers every position with a hole before doubling up, even on a tight budget', () => {
    const recruits = [
      ...Array.from({ length: 6 }, (_, i) => star(makeRecruit(`att-${i}`, 'ATT', 85 - i), 5)),
      makeRecruit('gk-0', 'GK', 55),
    ];
    const offers = suggest(recruits, { budget: 1.0 });
    expect(offers.some((o) => o.position === 'GK')).toBe(true);
    const total = offers.reduce((sum, o) => sum + o.scholarshipPercent / 100, 0);
    expect(total).toBeLessThanOrEqual(1.0 + 1e-9);
  });
});
