import { describe, expect, it } from 'vitest';
import {
  applyScholarshipOffer,
  calculateRecruitFitScore,
  classScholarshipBudgetUsed,
  recruitPrestigeMultiplier,
  topRecruitMotivations,
  type Recruit,
} from './recruiting';
import type { Team } from './models';

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
      scholarshipImportance: 65,
      playingTimeImportance: 55,
      academicImportance: 45,
    },
    interestByTeamId: {},
    scholarshipOffers: [],
    status: 'open',
    ...overrides,
  };
}

function makeTeam(overrides: Partial<Team<'GENERIC'>> = {}): Team<'GENERIC'> {
  return {
    id: 'team-1',
    name: 'Test University',
    shortName: 'Test',
    schoolName: 'Test University',
    conferenceId: 'conference-1',
    regionId: 'mid-atlantic',
    reputation: {
      nationalPrestige: 80,
      academicPrestige: 70,
      coachingPrestige: 75,
      facilities: 65,
      fanSupport: 60,
      recentSuccess: 78,
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

describe('Recruiting primitives', () => {
  it('calculates a higher fit score for a local prestigious team with scholarship room', () => {
    const recruit = makeRecruit();
    const localPower = makeTeam();
    const distantLowPrestige = makeTeam({
      id: 'team-2',
      regionId: 'west',
      reputation: {
        nationalPrestige: 20,
        academicPrestige: 30,
        coachingPrestige: 25,
        facilities: 30,
        fanSupport: 20,
        recentSuccess: 15,
      },
      resources: {
        scholarshipLimit: 12.6,
        scholarshipUsed: 12.6,
        recruitingBudget: 100_000,
        staffBudget: 250_000,
        facilitiesBudget: 500_000,
      },
    });

    expect(calculateRecruitFitScore(recruit, localPower)).toBeGreaterThan(
      calculateRecruitFitScore(recruit, distantLowPrestige),
    );
  });

  it('applies a scholarship offer without mutating the recruit', () => {
    const recruit = makeRecruit();
    const nextRecruit = applyScholarshipOffer(recruit, 'team-1', 50);

    expect(nextRecruit).not.toBe(recruit);
    expect(nextRecruit.scholarshipOffers).toEqual([{ teamId: 'team-1', scholarshipPercent: 50 }]);
    expect(nextRecruit.interestByTeamId['team-1']).toBeGreaterThan(recruit.interestByTeamId['team-1'] ?? 0);
  });

  it('updates an existing scholarship offer instead of duplicating it', () => {
    const recruit = applyScholarshipOffer(makeRecruit(), 'team-1', 25);
    const nextRecruit = applyScholarshipOffer(recruit, 'team-1', 75);

    expect(nextRecruit.scholarshipOffers).toEqual([{ teamId: 'team-1', scholarshipPercent: 75 }]);
  });

  it('dampens the offer interest boost through the interest multiplier', () => {
    const fullStrength = applyScholarshipOffer(makeRecruit(), 'team-1', 100);
    const dampened = applyScholarshipOffer(makeRecruit(), 'team-1', 100, 0.2);

    expect(dampened.interestByTeamId['team-1']).toBeLessThan(fullStrength.interestByTeamId['team-1']!);
    expect(dampened.interestByTeamId['team-1']).toBeGreaterThan(0);
  });
});

describe('recruitPrestigeMultiplier', () => {
  it('heavily dampens low-prestige pursuit of elite recruits', () => {
    expect(recruitPrestigeMultiplier(5, 47)).toBeLessThanOrEqual(0.3);
    expect(recruitPrestigeMultiplier(4, 50)).toBeLessThan(0.6);
  });

  it('rewards programs that meet or exceed a recruit expectations', () => {
    expect(recruitPrestigeMultiplier(5, 90)).toBe(1.1);
    expect(recruitPrestigeMultiplier(2, 60)).toBe(1.1);
  });

  it('scales smoothly for modest gaps', () => {
    const mult = recruitPrestigeMultiplier(3, 55);
    expect(mult).toBeGreaterThan(0.7);
    expect(mult).toBeLessThan(1);
  });
});

describe('classScholarshipBudgetUsed', () => {
  it('sums offers to open recruits and recruits committed to the team', () => {
    const recruits = [
      makeRecruit({ id: 'r1', scholarshipOffers: [{ teamId: 'team-1', scholarshipPercent: 100 }] }),
      makeRecruit({
        id: 'r2',
        status: 'committed',
        committedTeamId: 'team-1',
        scholarshipOffers: [{ teamId: 'team-1', scholarshipPercent: 50 }],
      }),
      makeRecruit({ id: 'r3', scholarshipOffers: [{ teamId: 'team-2', scholarshipPercent: 75 }] }),
    ];

    expect(classScholarshipBudgetUsed(recruits, 'team-1')).toBe(1.5);
  });

  it('releases budget when a recruit commits elsewhere', () => {
    const recruits = [
      makeRecruit({
        id: 'r1',
        status: 'committed',
        committedTeamId: 'team-2',
        scholarshipOffers: [
          { teamId: 'team-1', scholarshipPercent: 100 },
          { teamId: 'team-2', scholarshipPercent: 50 },
        ],
      }),
      makeRecruit({ id: 'r2', scholarshipOffers: [{ teamId: 'team-1', scholarshipPercent: 25 }] }),
    ];

    expect(classScholarshipBudgetUsed(recruits, 'team-1')).toBe(0.25);
  });
});

describe('topRecruitMotivations', () => {
  it('returns the strongest motivations in order', () => {
    const preferences = {
      proximityImportance: 70,
      prestigeImportance: 80,
      scholarshipImportance: 65,
      playingTimeImportance: 55,
      academicImportance: 45,
    };

    expect(topRecruitMotivations(preferences, 2)).toEqual(['prestige', 'proximity']);
    expect(topRecruitMotivations(preferences, 1)).toEqual(['prestige']);
  });
});
