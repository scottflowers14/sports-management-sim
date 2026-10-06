import { describe, expect, it } from 'vitest';
import { adPenaltyScale, cpuRecruitingScale } from './difficulty';
import { createFreshLacrosseDynasty } from './dynasty-factory';
import { autoCommitWeekly } from './dynasty-helpers';
import { createCoachProfile, evaluateSeasonGoals, generateSeasonGoals, updateADConfidence } from './coach-profile';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe('difficulty', () => {
  it('scales CPU recruiting and AD patience, with normal (and old saves) unchanged', () => {
    expect(cpuRecruitingScale('easy')).toBeLessThan(1);
    expect(cpuRecruitingScale('normal')).toBe(1);
    expect(cpuRecruitingScale(undefined)).toBe(1);
    expect(cpuRecruitingScale('hard')).toBeGreaterThan(1);
    expect(adPenaltyScale('easy')).toBeLessThan(1);
    expect(adPenaltyScale(undefined)).toBe(1);
    expect(adPenaltyScale('hard')).toBeGreaterThan(1);
  });

  it('makes CPU programs build interest faster on hard and slower on easy', () => {
    const dynasty = createFreshLacrosseDynasty({ now: () => 4242 });
    const cpuInterest = (scale: number) => {
      const recruits = autoCommitWeekly(dynasty.recruits, dynasty.season.teams, dynasty.userTeamId, 1, seededRandom(9), 10, scale);
      return recruits.reduce(
        (sum, r) => sum + Object.entries(r.interestByTeamId).reduce((n, [teamId, v]) => n + (teamId === dynasty.userTeamId ? 0 : v), 0),
        0,
      );
    };
    const easy = cpuInterest(cpuRecruitingScale('easy'));
    const normal = cpuInterest(1);
    const hard = cpuInterest(cpuRecruitingScale('hard'));
    expect(easy).toBeLessThan(normal);
    expect(hard).toBeGreaterThan(normal);
  });

  it('lets a hard AD take a bad season harder and an easy one softer, but not the good news', () => {
    const coach = { ...createCoachProfile('Pat Reyes'), tenureSeasons: 4 };
    const bad = evaluateSeasonGoals(generateSeasonGoals(62, 2030, 10), { wins: 2, losses: 8 }, 40, false, 1);
    const normal = updateADConfidence(60, bad, false, coach).confidence;
    const hard = updateADConfidence(60, bad, false, coach, { penaltyScale: adPenaltyScale('hard') });
    const easy = updateADConfidence(60, bad, false, coach, { penaltyScale: adPenaltyScale('easy') });
    expect(hard.confidence).toBeLessThan(normal);
    expect(hard.events.map((e) => e.description)).toContain('Impatient athletic director (Hard)');
    expect(easy.confidence).toBeGreaterThan(normal);

    const good = evaluateSeasonGoals(generateSeasonGoals(62, 2030, 10), { wins: 9, losses: 1 }, 3, true, 9);
    const goodNormal = updateADConfidence(60, good, true, coach).confidence;
    expect(updateADConfidence(60, good, true, coach, { penaltyScale: adPenaltyScale('hard') }).confidence).toBe(goodNormal);
  });
});
