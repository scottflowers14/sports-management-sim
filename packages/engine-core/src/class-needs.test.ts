import { describe, expect, it } from 'vitest';
import { classNeedsByPosition } from './class-needs';
import { makePlayer, makeRecruit, makeTeam } from './test-fixtures';

describe('class needs by position', () => {
  const senior = (id: string, position: 'ATT' | 'GK') => ({ ...makePlayer(id, position), classYear: 'SR' as const });

  it('counts graduates, returners, commitments and live offers', () => {
    const team = { ...makeTeam(), roster: [senior('a1', 'ATT'), senior('a2', 'ATT'), makePlayer('a3', 'ATT'), senior('g1', 'GK')] };
    const recruits = [
      { ...makeRecruit('r1', 'ATT', 70), status: 'committed' as const, committedTeamId: team.id },
      { ...makeRecruit('r2', 'ATT', 69), scholarshipOffers: [{ teamId: team.id, scholarshipPercent: 50 }] },
      // Lost to a rival: neither a commitment nor a live offer.
      {
        ...makeRecruit('r3', 'GK', 69),
        status: 'committed' as const,
        committedTeamId: 'rival',
        scholarshipOffers: [{ teamId: team.id, scholarshipPercent: 50 }],
      },
    ];
    const needs = classNeedsByPosition(team, recruits, ['ATT', 'GK', 'FOGO']);
    expect(needs.find((n) => n.position === 'ATT')).toEqual({
      position: 'ATT', graduating: 2, returning: 1, committed: 1, offersOut: 1, open: 1,
    });
    expect(needs.find((n) => n.position === 'GK')).toMatchObject({ graduating: 1, committed: 0, offersOut: 0, open: 1 });
    expect(needs.find((n) => n.position === 'FOGO')).toMatchObject({ graduating: 0, open: 0 });
  });

  it('never reports negative open spots when a class over-signs', () => {
    const team = { ...makeTeam(), roster: [senior('a1', 'ATT')] };
    const recruits = ['r1', 'r2'].map((id) => ({ ...makeRecruit(id, 'ATT', 70), status: 'committed' as const, committedTeamId: team.id }));
    expect(classNeedsByPosition(team, recruits)[0]).toMatchObject({ committed: 2, open: 0 });
  });
});
