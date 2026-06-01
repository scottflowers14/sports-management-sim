import { describe, expect, it } from 'vitest';
import type { Team } from './models';

describe('Team model', () => {
  it('represents scholarship usage with fractional limits for equivalency sports', () => {
    const team: Team<'GENERIC'> = {
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
        scholarshipLimit: 12.6,
        scholarshipUsed: 12.25,
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

    expect(team.resources.scholarshipLimit).toBe(12.6);
    expect(team.resources.scholarshipUsed).toBeLessThanOrEqual(team.resources.scholarshipLimit);
  });
});
