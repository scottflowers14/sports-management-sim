import { describe, expect, it } from 'vitest';
import type { Team } from './models';
import { validateTeamScholarships } from './team-validation';

function makeTeam(scholarshipUsed: number, scholarshipLimit = 12.6): Team<'GENERIC'> {
  return {
    id: 'team-1',
    name: 'Test University',
    shortName: 'Test',
    schoolName: 'Test University',
    conferenceId: 'conference-1',
    regionId: 'region-1',
    reputation: {
      nationalPrestige: 50,
      academicPrestige: 60,
      coachingPrestige: 55,
      facilities: 50,
      fanSupport: 45,
      recentSuccess: 40,
    },
    resources: {
      scholarshipLimit,
      scholarshipUsed,
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

describe('validateTeamScholarships', () => {
  it('accepts a team at or below its scholarship limit', () => {
    expect(validateTeamScholarships(makeTeam(12.6))).toEqual({
      ok: true,
      value: makeTeam(12.6),
    });
  });

  it('rejects a team above its scholarship limit', () => {
    expect(validateTeamScholarships(makeTeam(12.7))).toEqual({
      ok: false,
      error: 'Team team-1 exceeds scholarship limit: 12.7/12.6',
    });
  });
});
