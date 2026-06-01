import { describe, expect, it } from 'vitest';
import type { Recruit } from './recruiting';
import type { Team } from './models';
import { commitRecruit, rankRecruitCandidates } from './recruit-commitment';

function makeRecruit(overrides: Partial<Recruit<'GENERIC'>> = {}): Recruit<'GENERIC'> {
  return {
    id: 'recruit-1',
    name: { first: 'Casey', last: 'Smith' },
    age: 17,
    hometown: 'Baltimore, MD',
    regionId: 'mid-atlantic',
    position: 'GENERIC',
    starRating: 4,
    ratings: {
      overall: 62,
      potential: 84,
      athleticism: 70,
      speed: 72,
      strength: 55,
      stamina: 65,
      skill: 68,
      iq: 64,
      discipline: 58,
      workEthic: 75,
      leadership: 50,
    },
    preferences: {
      proximityImportance: 70,
      prestigeImportance: 80,
      scholarshipImportance: 90,
      playingTimeImportance: 55,
      academicImportance: 45,
    },
    interestByTeamId: {},
    scholarshipOffers: [],
    status: 'open',
    ...overrides,
  };
}

function makeTeam(id: string, overrides: Partial<Team<'GENERIC'>> = {}): Team<'GENERIC'> {
  return {
    id,
    name: `${id} University`,
    shortName: id,
    schoolName: `${id} University`,
    conferenceId: 'conference-1',
    regionId: 'mid-atlantic',
    reputation: {
      nationalPrestige: 70,
      academicPrestige: 70,
      coachingPrestige: 70,
      facilities: 70,
      fanSupport: 70,
      recentSuccess: 70,
    },
    resources: {
      scholarshipLimit: 12.6,
      scholarshipUsed: 11.6,
      recruitingBudget: 100_000,
      staffBudget: 250_000,
      facilitiesBudget: 500_000,
    },
    roster: [],
    record: {
      wins: 0,
      losses: 0,
      conferenceWins: 0,
      conferenceLosses: 0,
      homeWins: 0,
      homeLosses: 0,
      awayWins: 0,
      awayLosses: 0,
      neutralWins: 0,
      neutralLosses: 0,
    },
    createdSeason: 2027,
    ...overrides,
  };
}

describe('recruit commitment', () => {
  it('ranks candidate teams by interest, fit, and scholarship offer', () => {
    const recruit = makeRecruit({
      interestByTeamId: { contender: 55, favorite: 80 },
      scholarshipOffers: [
        { teamId: 'contender', scholarshipPercent: 100 },
        { teamId: 'favorite', scholarshipPercent: 25 },
      ],
    });
    const teams = [makeTeam('contender'), makeTeam('favorite')];

    expect(rankRecruitCandidates(recruit, teams)[0]?.team.id).toBe('favorite');
  });

  it('commits an open recruit to the highest-ranked candidate', () => {
    const recruit = makeRecruit({
      interestByTeamId: { alpha: 20, beta: 85 },
      scholarshipOffers: [{ teamId: 'beta', scholarshipPercent: 50 }],
    });
    const committedRecruit = commitRecruit(recruit, [makeTeam('alpha'), makeTeam('beta')]);

    expect(committedRecruit).toMatchObject({
      status: 'committed',
      committedTeamId: 'beta',
    });
    expect(recruit.status).toBe('open');
    expect(recruit.committedTeamId).toBeUndefined();
  });

  it('leaves an already committed recruit unchanged', () => {
    const recruit = makeRecruit({ status: 'committed', committedTeamId: 'alpha' });

    expect(commitRecruit(recruit, [makeTeam('beta')])).toEqual(recruit);
  });

  it('leaves an open recruit unchanged when there are no candidates', () => {
    const recruit = makeRecruit();

    expect(commitRecruit(recruit, [])).toEqual(recruit);
  });
});
