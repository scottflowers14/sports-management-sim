import { describe, expect, it } from 'vitest';
import { advanceCoachTenure, contractNewsHeadline, createCoachProfile, evaluateSeasonGoals, generateJobOffers, generateSeasonGoals, getJobSecurityLabel, reviewCoachContract, shouldFireCoach, STARTING_AD_CONFIDENCE, updateADConfidence } from './coach-profile';

describe('generateSeasonGoals', () => {
  it('scales the win target to the actual schedule length', () => {
    // Low-prestige program with only 5 games: ~30% of 5 → 2 wins, not a fixed 5+
    expect(generateSeasonGoals(40, 2028, 5).winTarget).toBe(2);
    // Elite program with 5 games: 75% → 4 wins
    expect(generateSeasonGoals(85, 2028, 5).winTarget).toBe(4);
    // Elite program with a 14-game slate: 75% → 11 wins (old fixed behavior preserved at full length)
    expect(generateSeasonGoals(85, 2028, 14).winTarget).toBe(11);
  });

  it('never demands more wins than there are games', () => {
    for (const prestige of [40, 55, 70, 90]) {
      for (const games of [1, 3, 5, 12, 20]) {
        const goals = generateSeasonGoals(prestige, 2028, games);
        expect(goals.winTarget).toBeGreaterThanOrEqual(1);
        expect(goals.winTarget).toBeLessThanOrEqual(games);
      }
    }
  });

  it('keeps prestige-based expectations ordered', () => {
    const games = 12;
    const low = generateSeasonGoals(40, 2028, games).winTarget;
    const mid = generateSeasonGoals(60, 2028, games).winTarget;
    const high = generateSeasonGoals(85, 2028, games).winTarget;
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);
  });
});

describe('shouldFireCoach', () => {
  it('fires an established coach once confidence drops below 20', () => {
    expect(shouldFireCoach(19, 3)).toBe(true);
    expect(shouldFireCoach(19, 6)).toBe(true);
    expect(shouldFireCoach(20, 3)).toBe(false);
  });

  it('protects early-tenure coaches unless confidence totally collapses', () => {
    expect(shouldFireCoach(19, 1)).toBe(false);
    expect(shouldFireCoach(10, 2)).toBe(false);
    expect(shouldFireCoach(5, 0)).toBe(true);
    expect(shouldFireCoach(0, 1)).toBe(true);
  });
});

describe('generateJobOffers', () => {
  const makeTeam = (id: string, prestige: number) => ({
    id,
    name: `Team ${id}`,
    reputation: { nationalPrestige: prestige },
  });

  const teams = [
    makeTeam('a', 90),
    makeTeam('b', 80),
    makeTeam('c', 70),
    makeTeam('d', 60),
    makeTeam('e', 55),
    makeTeam('f', 50),
    makeTeam('g', 45),
    makeTeam('h', 42),
  ];

  it('offers up to three jobs, never from the fired team', () => {
    const offers = generateJobOffers(teams, 'a', 12345);
    expect(offers).toHaveLength(3);
    expect(offers.every((o) => o.teamId !== 'a')).toBe(true);
    expect(new Set(offers.map((o) => o.teamId)).size).toBe(3);
  });

  it('only offers jobs at lower-prestige programs', () => {
    const offers = generateJobOffers(teams, 'a', 999);
    // Bottom half of remaining teams: prestige 55 and below (e, f, g, h)
    expect(offers.every((o) => o.prestige <= 60)).toBe(true);
  });

  it('is deterministic for a given seed', () => {
    expect(generateJobOffers(teams, 'a', 7)).toEqual(generateJobOffers(teams, 'a', 7));
  });

  it('handles tiny leagues without crashing', () => {
    const offers = generateJobOffers([makeTeam('a', 60), makeTeam('b', 50)], 'a', 1);
    expect(offers).toHaveLength(1);
    expect(offers[0]!.teamId).toBe('b');
  });
});

describe('reviewCoachContract', () => {
  const coach = (left: number) => ({ ...createCoachProfile('Pat Reyes'), contractYearsRemaining: left });

  it('gives a coach on extension watch a fresh five-year deal once two years or fewer remain', () => {
    expect(reviewCoachContract(coach(2), 85)).toMatchObject({ decision: 'extended', yearsAdded: 3, profile: { contractYearsRemaining: 5 } });
    expect(reviewCoachContract(coach(0), 100)).toMatchObject({ decision: 'extended', profile: { contractYearsRemaining: 5 } });
  });

  it('waits for a winning season before handing out a new deal', () => {
    expect(reviewCoachContract(coach(2), 88, { wins: 3, losses: 7 })).toMatchObject({ decision: null, yearsAdded: 0 });
    expect(reviewCoachContract(coach(2), 88, { wins: 5, losses: 5 })).toMatchObject({ decision: 'extended' });
    // An expiring deal is still renewed on confidence alone.
    expect(reviewCoachContract(coach(0), 88, { wins: 3, losses: 7 })).toMatchObject({ decision: 'renewed' });
  });

  it('leaves a contract with years to run alone', () => {
    expect(reviewCoachContract(coach(3), 95)).toMatchObject({ decision: null, yearsAdded: 0, profile: { contractYearsRemaining: 3 } });
    expect(reviewCoachContract(coach(1), 50)).toMatchObject({ decision: null });
  });

  it('renews, offers a prove-it year, or lets an expiring deal lapse by confidence', () => {
    expect(reviewCoachContract(coach(0), 65)).toMatchObject({ decision: 'renewed', profile: { contractYearsRemaining: 3 } });
    expect(reviewCoachContract(coach(0), 45)).toMatchObject({ decision: 'prove-it', profile: { contractYearsRemaining: 1 } });
    expect(reviewCoachContract(coach(0), 30)).toMatchObject({ decision: 'not-renewed', profile: { contractYearsRemaining: 0 } });
  });

  it('never lets a long, successful tenure count down to zero', () => {
    let profile = createCoachProfile('Pat Reyes');
    for (let year = 0; year < 15; year += 1) {
      profile = reviewCoachContract(advanceCoachTenure(profile), 100).profile;
      expect(profile.contractYearsRemaining).toBeGreaterThanOrEqual(2);
    }
    expect(profile.tenureSeasons).toBe(15);
  });

  it('writes a headline with the year the new deal runs through', () => {
    const review = reviewCoachContract(coach(1), 90);
    expect(contractNewsHeadline(review, 'Capital City', 2031)).toBe('Capital City extends Pat Reyes through 2036, a 5-year deal');
    expect(contractNewsHeadline(reviewCoachContract(coach(3), 90), 'Capital City', 2031)).toBeNull();
  });
});

describe('expectation-aware goals and confidence', () => {
  it('lowers the bar for a program picked last and raises it for the favorite', () => {
    const mid = generateSeasonGoals(62, 2030, 10);
    const last = generateSeasonGoals(62, 2030, 10, { pickedFinish: 6, conferenceSize: 6 });
    const first = generateSeasonGoals(62, 2030, 10, { pickedFinish: 1, conferenceSize: 6 });
    expect(last.winTarget).toBeLessThan(mid.winTarget);
    expect(first.winTarget).toBeGreaterThan(mid.winTarget);
    expect(first.confChampGoal).toBe(true);
    expect(last.rankingGoal).toBeNull();
  });

  it('gives a rebuild two losing seasons before the hot seat', () => {
    const coach = createCoachProfile('Pat Reyes');
    const goals = (year: number) =>
      evaluateSeasonGoals(generateSeasonGoals(62, year, 10, { pickedFinish: 5, conferenceSize: 6 }), { wins: 3, losses: 7 }, 30, false, 4);
    let confidence = STARTING_AD_CONFIDENCE;
    confidence = updateADConfidence(confidence, goals(2030), false, coach, { wins: 3, pickedFinish: 5, confFinish: 5 }).confidence;
    const year2 = updateADConfidence(confidence, goals(2031), false, advanceCoachTenure(coach), {
      wins: 4, previousWins: 3, pickedFinish: 5, confFinish: 5,
    }).confidence;
    expect(getJobSecurityLabel(year2)).not.toBe('Hot Seat');
    expect(year2).toBeGreaterThanOrEqual(40);
  });

  it('credits improvement and beating the preseason pick', () => {
    const coach = { ...createCoachProfile('Pat Reyes'), tenureSeasons: 4 };
    const goals = evaluateSeasonGoals(generateSeasonGoals(62, 2030, 10), { wins: 6, losses: 4 }, 20, false, 5);
    const plain = updateADConfidence(60, goals, false, coach).confidence;
    const { confidence, events } = updateADConfidence(60, goals, false, coach, { wins: 6, previousWins: 3, pickedFinish: 5, confFinish: 2 });
    expect(confidence).toBe(plain + 9);
    expect(events.map((e) => e.description)).toContain('Improved by 3 wins');
    expect(events.map((e) => e.description)).toContain('Finished 3 spots above the preseason pick');
    const slipped = updateADConfidence(60, goals, false, coach, { wins: 6, previousWins: 9 });
    expect(slipped.confidence).toBe(plain - 5);
  });
});
