import { describe, expect, it } from 'vitest';
import { rollLacrosseInjuries } from './injuries';
import type { LacrossePlayer } from './models';
import {
  autoDevelopmentPlans,
  carryOverallChangeToSkills,
  MAX_DEVELOPMENT_PLANS,
  PROGRESS_PER_POINT,
  prunePracticePlan,
  PRACTICE_INTENSITIES,
  ratingsImprovedBy,
  runPracticeWeek,
  weeklyPracticeProgress,
  type LacrossePracticePlan,
} from './practice';
import { generateLacrosseRoster } from './roster-generation';
import { makeLacrossePlayer, makeLacrosseTeam } from './test-fixtures';

const AVERAGE_COACH = 65;

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function progress(player: LacrossePlayer, overrides: Partial<Parameters<typeof weeklyPracticeProgress>[1]> = {}) {
  return weeklyPracticeProgress(player, {
    intensity: 'normal',
    hasPlan: false,
    developmentRating: AVERAGE_COACH,
    minutesShare: 0,
    ...overrides,
  });
}

describe('weekly practice progress', () => {
  const prospect = makeLacrossePlayer(1, 'ATT');

  it('stops at a player’s ceiling and slows as he nears it', () => {
    const capped = { ...prospect, ratings: { ...prospect.ratings, overall: 70, potential: 70 } };
    const close = { ...prospect, ratings: { ...prospect.ratings, overall: 67, potential: 70 } };
    expect(progress(capped)).toBe(0);
    expect(progress(close)).toBeLessThan(progress(prospect));
  });

  it('grows faster with harder practice, an individual plan, game minutes, work ethic and a better coach', () => {
    const base = progress(prospect);
    expect(progress(prospect, { intensity: 'light' })).toBeLessThan(base);
    expect(progress(prospect, { intensity: 'intense' })).toBeGreaterThan(base);
    expect(progress(prospect, { hasPlan: true })).toBeGreaterThan(base * 1.5);
    expect(progress(prospect, { minutesShare: 1 })).toBeGreaterThan(base);
    expect(progress(prospect, { developmentRating: 90 })).toBeGreaterThan(base);
    const grinder = { ...prospect, ratings: { ...prospect.ratings, workEthic: 95 } };
    expect(progress(grinder)).toBeGreaterThan(base);
  });

  it('trades injury risk for growth across the three intensities', () => {
    expect(PRACTICE_INTENSITIES.light.injuryRisk).toBeLessThan(PRACTICE_INTENSITIES.normal.injuryRisk);
    expect(PRACTICE_INTENSITIES.intense.injuryRisk).toBeGreaterThan(PRACTICE_INTENSITIES.normal.injuryRisk);
    expect(PRACTICE_INTENSITIES.light.progress).toBeLessThan(PRACTICE_INTENSITIES.intense.progress);
  });
});

describe('which skills grow', () => {
  it('raises every skill in a focused area', () => {
    expect(ratingsImprovedBy(makeLacrossePlayer(1, 'ATT'), 'shooting')).toEqual(['shooting', 'offBallMovement']);
    expect(ratingsImprovedBy(makeLacrossePlayer(2, 'FOGO'), 'faceoffs')).toEqual(['faceoffs', 'groundBalls']);
    expect(ratingsImprovedBy(makeLacrossePlayer(3, 'GK'), 'goaltending')).toEqual([
      'goalieReflexes',
      'goaliePositioning',
      'goalieClearing',
    ]);
  });

  it('works on the weakest position skills and physical tool on a balanced plan', () => {
    // The fixture defender checks at 45 and defends at 50; his strength (50) is his weakest tool.
    expect(ratingsImprovedBy(makeLacrossePlayer(4, 'DEF'), 'balanced')).toEqual(['checking', 'defense', 'strength']);
  });

  it('never grows a skill the player doesn’t have', () => {
    // A field player can't learn goaltending; the plan falls back to balanced.
    const att = makeLacrossePlayer(5, 'ATT');
    expect(ratingsImprovedBy(att, 'goaltending')).toEqual(ratingsImprovedBy(att, 'balanced'));
    expect(ratingsImprovedBy(att, 'faceoffs')).toEqual(['groundBalls']);
  });
});

describe('a practice week', () => {
  const player = { ...makeLacrossePlayer(1, 'ATT'), developmentProgress: PROGRESS_PER_POINT - 1 };
  const team = makeLacrosseTeam('durham', [player, makeLacrossePlayer(2, 'MID')]);
  const shootingPlan: LacrossePracticePlan = {
    intensity: 'normal',
    developmentPlans: [{ playerId: player.id, focus: 'shooting' }],
  };

  it('turns banked progress into an overall point and the plan’s skills', () => {
    const { team: after, gains } = runPracticeWeek(team, shootingPlan, { developmentRating: AVERAGE_COACH, played: false });
    const grown = after.roster.find((p) => p.id === player.id)!;
    expect(gains).toEqual([{ playerId: player.id, from: 50, to: 51, improved: ['shooting', 'offBallMovement'] }]);
    expect(grown.ratings.overall).toBe(51);
    expect(grown.sportTraits.shooting).toBe(51);
    expect(grown.sportTraits.offBallMovement).toBe(51);
    expect(grown.sportTraits.passing).toBe(50);
    expect(grown.developmentProgress).toBeLessThan(PROGRESS_PER_POINT);
  });

  it('skips injured players and leaves players at their ceiling unchanged', () => {
    const injured = runPracticeWeek(team, shootingPlan, {
      developmentRating: AVERAGE_COACH,
      played: false,
      skipPlayerIds: new Set([player.id]),
    });
    expect(injured.gains).toHaveLength(0);
    expect(injured.team.roster[0]).toBe(team.roster[0]);

    const capped = { ...player, ratings: { ...player.ratings, overall: 70, potential: 70 } };
    const result = runPracticeWeek(makeLacrosseTeam('durham', [capped]), shootingPlan, {
      developmentRating: AVERAGE_COACH,
      played: true,
    });
    expect(result.gains).toHaveLength(0);
    expect(result.team.roster[0]!.ratings.overall).toBe(70);
  });

  it('only honors the first four individual plans', () => {
    const roster = Array.from({ length: 6 }, (_, i) => makeLacrossePlayer(i, 'MID'));
    const greedy: LacrossePracticePlan = {
      intensity: 'normal',
      developmentPlans: roster.map((p) => ({ playerId: p.id, focus: 'balanced' as const })),
    };
    const { team: after } = runPracticeWeek(makeLacrosseTeam('durham', roster), greedy, {
      developmentRating: AVERAGE_COACH,
      played: false,
    });
    const banked = after.roster.map((p) => p.developmentProgress ?? 0);
    expect(banked.slice(0, MAX_DEVELOPMENT_PLANS).every((v) => v === banked[0])).toBe(true);
    expect(banked[MAX_DEVELOPMENT_PLANS]!).toBeLessThan(banked[0]!);
  });

  it('makes a planned player on intense practice grow well past his unplanned twin over a season', () => {
    const roster = generateLacrosseRoster({ seed: 11, prestige: 70, createdSeason: 2028 });
    const young = roster.find((p) => p.classYear === 'FR' && p.ratings.potential - p.ratings.overall >= 10)!;
    const twin = { ...young, id: 'twin' };
    let current = makeLacrosseTeam('durham', [...roster, twin]);
    const plan: LacrossePracticePlan = { intensity: 'intense', developmentPlans: [{ playerId: young.id, focus: 'balanced' }] };
    for (let week = 0; week < 10; week += 1) {
      current = runPracticeWeek(current, plan, { developmentRating: AVERAGE_COACH, played: true }).team;
    }
    const planned = current.roster.find((p) => p.id === young.id)!.ratings.overall - young.ratings.overall;
    const unplanned = current.roster.find((p) => p.id === 'twin')!.ratings.overall - young.ratings.overall;
    expect(planned).toBeGreaterThanOrEqual(2);
    expect(planned).toBeGreaterThan(unplanned);
  });
});

describe('offseason skill growth', () => {
  it('moves every lacrosse skill with the overall change and keeps handedness', () => {
    const before = makeLacrossePlayer(1, 'GK');
    const grown = { ...before, ratings: { ...before.ratings, overall: 53 } };
    const carried = carryOverallChangeToSkills(grown, 50);
    expect(carried.sportTraits.goalieReflexes).toBe(78);
    expect(carried.sportTraits.shooting).toBe(53);
    expect(carried.sportTraits.preferredHand).toBe(before.sportTraits.preferredHand);
    expect(carryOverallChangeToSkills(before, 50)).toBe(before);
    const slipped = carryOverallChangeToSkills({ ...before, ratings: { ...before.ratings, overall: 49 } }, 50);
    expect(slipped.sportTraits.checking).toBe(44);
  });
});

describe('CPU development plans', () => {
  it('go to underclassmen with the most room to grow', () => {
    const roster = generateLacrosseRoster({ seed: 3, prestige: 60, createdSeason: 2028 });
    const plans = autoDevelopmentPlans(makeLacrosseTeam('durham', roster));
    expect(plans).toHaveLength(MAX_DEVELOPMENT_PLANS);
    const picked = plans.map((p) => roster.find((r) => r.id === p.playerId)!);
    expect(picked.every((p) => p.classYear !== 'SR' && p.classYear !== 'GR')).toBe(true);
    const gap = (p: LacrossePlayer) => p.ratings.potential - p.ratings.overall;
    const smallestPicked = Math.min(...picked.map(gap));
    const bestLeftOut = Math.max(
      ...roster.filter((p) => p.classYear !== 'SR' && p.classYear !== 'GR' && !picked.includes(p)).map(gap),
    );
    expect(smallestPicked).toBeGreaterThanOrEqual(bestLeftOut);
  });

  it('drop players who leave the roster', () => {
    const team = makeLacrosseTeam('durham', [makeLacrossePlayer(1, 'ATT')]);
    const plan: LacrossePracticePlan = {
      intensity: 'light',
      developmentPlans: [
        { playerId: 'player-1', focus: 'shooting' },
        { playerId: 'graduated', focus: 'defense' },
      ],
    };
    expect(prunePracticePlan(plan, team).developmentPlans).toEqual([{ playerId: 'player-1', focus: 'shooting' }]);
    const clean = prunePracticePlan(plan, team);
    expect(prunePracticePlan(clean, team)).toBe(clean);
  });
});

describe('practice intensity and injuries', () => {
  it('scales injury risk', () => {
    const team = makeLacrosseTeam('durham', generateLacrosseRoster({ seed: 7, prestige: 70, createdSeason: 2028 }));
    const count = (riskMultiplier: number) => {
      const random = seededRandom(9);
      let total = 0;
      for (let w = 0; w < 400; w += 1) total += rollLacrosseInjuries(team, { played: true, random, riskMultiplier }).length;
      return total;
    };
    const light = count(PRACTICE_INTENSITIES.light.injuryRisk);
    const intense = count(PRACTICE_INTENSITIES.intense.injuryRisk);
    expect(intense / light).toBeGreaterThan(1.6);
  });
});
