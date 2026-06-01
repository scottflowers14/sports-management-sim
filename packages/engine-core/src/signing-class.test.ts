import { describe, expect, it } from 'vitest';
import type { Recruit } from './recruiting';
import type { Team } from './models';
import { addSignedRecruitsToTeam, signCommittedRecruit } from './signing-class';

function makeRecruit(id: string, committedTeamId: string, scholarshipPercent = 25): Recruit<'GENERIC', { trait: number }> {
  return {
    id,
    name: { first: 'Casey', last: id },
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
    sportTraits: { trait: 1 },
    preferences: {
      proximityImportance: 70,
      prestigeImportance: 80,
      scholarshipImportance: 90,
      playingTimeImportance: 55,
      academicImportance: 45,
    },
    interestByTeamId: { [committedTeamId]: 90 },
    scholarshipOffers: [{ teamId: committedTeamId, scholarshipPercent }],
    committedTeamId,
    status: 'committed',
  };
}

function makeTeam(id: string): Team<'GENERIC', { trait: number }> {
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
      scholarshipUsed: 10,
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
  };
}

describe('signing class', () => {
  it('signs a committed recruit to their committed team', () => {
    const signed = signCommittedRecruit(makeRecruit('recruit-1', 'team-1'));

    expect(signed).toMatchObject({ status: 'signed', signedTeamId: 'team-1' });
  });

  it('does not sign an open recruit', () => {
    const { committedTeamId: _committedTeamId, ...openRecruit } = makeRecruit('recruit-1', 'team-1');
    const recruit: Recruit<'GENERIC', { trait: number }> = { ...openRecruit, status: 'open' };

    expect(signCommittedRecruit(recruit)).toEqual(recruit);
  });

  it('adds signed recruits for a team as freshmen roster players and updates scholarships', () => {
    const team = makeTeam('team-1');
    const signedRecruit = signCommittedRecruit(makeRecruit('recruit-1', 'team-1', 50));
    const nextTeam = addSignedRecruitsToTeam(team, [signedRecruit], 2028);

    expect(nextTeam).not.toBe(team);
    expect(nextTeam.roster).toHaveLength(1);
    expect(nextTeam.roster[0]).toMatchObject({
      id: 'player-from-recruit-1',
      classYear: 'FR',
      position: 'GENERIC',
      scholarshipPercent: 50,
      isWalkOn: false,
      createdSeason: 2028,
    });
    expect(nextTeam.resources.scholarshipUsed).toBe(10.5);
  });

  it('ignores signed recruits for other teams', () => {
    const team = makeTeam('team-1');
    const otherRecruit = signCommittedRecruit(makeRecruit('recruit-1', 'team-2'));

    expect(addSignedRecruitsToTeam(team, [otherRecruit], 2028)).toEqual(team);
  });
});
