import { describe, expect, it } from 'vitest';
import {
  applyCampusVisit,
  applyRecruitPitch,
  chooseCommitTeam,
  finalistTeamIds,
  isFinalistPhase,
  recruitDecisionWeek,
  shouldReopenCommitment,
} from './recruiting-actions';
import type { Recruit } from './recruiting';
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
      academicImportance: 40,
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

describe('applyRecruitPitch', () => {
  it('lands a strong pitch when the motivation is a top priority', () => {
    const recruit = makeRecruit({ interestByTeamId: { 'team-1': 40 } });
    const outcome = applyRecruitPitch(recruit, 'team-1', 'prestige');

    expect(outcome.result).toBe('strong');
    expect(outcome.interestChange).toBe(13);
    expect(outcome.recruit.interestByTeamId['team-1']).toBe(53);
  });

  it('falls flat and costs goodwill when the recruit does not care', () => {
    const recruit = makeRecruit({ interestByTeamId: { 'team-1': 40 } });
    const outcome = applyRecruitPitch(recruit, 'team-1', 'academics');

    expect(outcome.result).toBe('flat');
    expect(outcome.interestChange).toBe(-3);
    expect(outcome.recruit.interestByTeamId['team-1']).toBe(37);
  });

  it('dampens gains through the interest multiplier without dampening backfires', () => {
    const boosted = applyRecruitPitch(makeRecruit(), 'team-1', 'prestige', 0.5);
    expect(boosted.interestChange).toBe(7);

    const backfire = applyRecruitPitch(makeRecruit(), 'team-1', 'academics', 0.5);
    expect(backfire.interestChange).toBe(-3);
  });

  it('halves gains on flip attempts against recruits committed elsewhere', () => {
    const recruit = makeRecruit({
      status: 'committed',
      committedTeamId: 'team-2',
      interestByTeamId: { 'team-1': 40, 'team-2': 80 },
    });
    const outcome = applyRecruitPitch(recruit, 'team-1', 'prestige');

    expect(outcome.interestChange).toBe(7);
    expect(outcome.recruit.interestByTeamId['team-1']).toBe(47);
  });

  it('never pushes interest outside 0-100', () => {
    const maxed = applyRecruitPitch(makeRecruit({ interestByTeamId: { 'team-1': 97 } }), 'team-1', 'prestige');
    expect(maxed.recruit.interestByTeamId['team-1']).toBe(100);

    const floored = applyRecruitPitch(makeRecruit({ interestByTeamId: { 'team-1': 1 } }), 'team-1', 'academics');
    expect(floored.recruit.interestByTeamId['team-1']).toBe(0);
  });
});

describe('applyCampusVisit', () => {
  it('rewards a ranked home win far more than a bad loss', () => {
    const bigWin = applyCampusVisit(makeRecruit(), 'team-1', {
      won: true,
      opponentRank: 4,
      facilities: 80,
    });
    const dudLoss = applyCampusVisit(makeRecruit(), 'team-1', {
      won: false,
      opponentRank: null,
      facilities: 40,
    });

    expect(bigWin.interestChange).toBeGreaterThan(dudLoss.interestChange + 10);
    expect(bigWin.impression).toBe('electric');
    expect(dudLoss.impression).toBe('flat');
  });

  it('gives big-stage recruits an extra kick from wins over ranked opponents', () => {
    const bigStage = makeRecruit({
      preferences: {
        proximityImportance: 40,
        prestigeImportance: 95,
        scholarshipImportance: 45,
        playingTimeImportance: 50,
        academicImportance: 35,
      },
    });
    const homebody = makeRecruit({
      preferences: {
        proximityImportance: 45,
        prestigeImportance: 40,
        scholarshipImportance: 95,
        playingTimeImportance: 90,
        academicImportance: 35,
      },
    });
    const context = { won: true, opponentRank: 8, facilities: 60 };

    const bigStageVisit = applyCampusVisit(bigStage, 'team-1', context);
    const homebodyVisit = applyCampusVisit(homebody, 'team-1', context);

    expect(bigStageVisit.interestChange).toBeGreaterThan(homebodyVisit.interestChange);
  });

  it('always produces at least a small positive bump', () => {
    const outcome = applyCampusVisit(makeRecruit(), 'team-1', {
      won: false,
      facilities: 30,
      interestMultiplier: 0.2,
    });
    expect(outcome.interestChange).toBeGreaterThanOrEqual(1);
  });
});

describe('recruitDecisionWeek', () => {
  it('is deterministic per recruit', () => {
    expect(recruitDecisionWeek('recruit-1', 3, 10)).toBe(recruitDecisionWeek('recruit-1', 3, 10));
  });

  it('keeps decisions within the recruiting calendar', () => {
    for (let star = 1; star <= 5; star += 1) {
      for (let i = 0; i < 25; i += 1) {
        const week = recruitDecisionWeek(`recruit-${i}`, star, 10);
        expect(week).toBeGreaterThanOrEqual(3);
        expect(week).toBeLessThanOrEqual(12);
      }
    }
  });

  it('has five-stars deciding later than one-stars on average', () => {
    const avg = (star: number) => {
      let total = 0;
      for (let i = 0; i < 40; i += 1) total += recruitDecisionWeek(`recruit-${i}`, star, 10);
      return total / 40;
    };
    expect(avg(5)).toBeGreaterThan(avg(1) + 2);
  });
});

describe('finalistTeamIds and isFinalistPhase', () => {
  it('ranks offer-holding teams by interest', () => {
    const recruit = makeRecruit({
      scholarshipOffers: [
        { teamId: 'team-1', scholarshipPercent: 50 },
        { teamId: 'team-2', scholarshipPercent: 100 },
        { teamId: 'team-3', scholarshipPercent: 25 },
        { teamId: 'team-4', scholarshipPercent: 50 },
      ],
      interestByTeamId: { 'team-1': 55, 'team-2': 80, 'team-3': 62, 'team-4': 12 },
    });

    expect(finalistTeamIds(recruit)).toEqual(['team-2', 'team-3', 'team-1']);
  });

  it('marks the weeks leading into the decision as the finalist phase', () => {
    expect(isFinalistPhase(5, 9)).toBe(false);
    expect(isFinalistPhase(6, 9)).toBe(true);
    expect(isFinalistPhase(8, 9)).toBe(true);
    expect(isFinalistPhase(9, 9)).toBe(false);
  });
});

describe('chooseCommitTeam', () => {
  it('picks the clear interest leader', () => {
    const recruit = makeRecruit({
      scholarshipOffers: [
        { teamId: 'team-1', scholarshipPercent: 100 },
        { teamId: 'team-2', scholarshipPercent: 100 },
      ],
      interestByTeamId: { 'team-1': 95, 'team-2': 40 },
    });
    const teams = [makeTeam({ id: 'team-1' }), makeTeam({ id: 'team-2' })];

    expect(chooseCommitTeam(recruit, teams, () => 0.5)).toBe('team-1');
  });

  it('returns undefined without offers from known teams', () => {
    expect(chooseCommitTeam(makeRecruit(), [makeTeam()], () => 0.5)).toBeUndefined();
  });
});

describe('shouldReopenCommitment', () => {
  const committed = (committedInterest: number, rivalInterest: number) =>
    makeRecruit({
      status: 'committed',
      committedTeamId: 'team-2',
      interestByTeamId: { 'team-1': rivalInterest, 'team-2': committedInterest },
    });

  it('never wavers while the committed school still leads comfortably', () => {
    expect(shouldReopenCommitment(committed(80, 70), () => 0)).toBe(false);
  });

  it('can reopen when a rival has clearly overtaken the committed school', () => {
    expect(shouldReopenCommitment(committed(60, 85), () => 0)).toBe(true);
    expect(shouldReopenCommitment(committed(60, 85), () => 0.99)).toBe(false);
  });

  it('ignores open and signed recruits', () => {
    expect(shouldReopenCommitment(makeRecruit(), () => 0)).toBe(false);
    expect(
      shouldReopenCommitment(
        makeRecruit({ status: 'signed', signedTeamId: 'team-2', interestByTeamId: { 'team-1': 90 } }),
        () => 0,
      ),
    ).toBe(false);
  });
});
