import { describe, expect, it } from 'vitest';
import { createFreshLacrosseDynasty } from './dynasty-factory';
import { createScoutingState } from './scouting';
import { emptyRecruitingActivity } from './recruiting-activity';
import { emptySeasonStats } from './stats';
import { simulateOneWeek, type WeekSimState } from './week-sim';
import { applyAssistantToWeekState } from './recruiting-assistant';
import { attainableBoardScore, landChance, landLabel, type LandChanceContext } from './recruit-odds';
import type { LacrosseRecruit } from '@sports-management-sim/sport-lacrosse';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function freshState(now: number): WeekSimState {
  return {
    dynasty: createFreshLacrosseDynasty({ now: () => now }),
    rankings: [],
    injuries: [],
    newsItems: [],
    scouting: createScoutingState(),
    recruitingActivity: emptyRecruitingActivity(),
    recruitTrends: {},
    seasonStats: emptySeasonStats(),
    gameLogs: new Map(),
    bestNatRank: null,
    lastSimWeek: null,
  };
}

function contextOf(state: WeekSimState, currentWeek = state.dynasty.season.currentWeek): LandChanceContext {
  const { dynasty } = state;
  return {
    userTeam: dynasty.season.teams.find((t) => t.id === dynasty.userTeamId)!,
    teams: dynasty.season.teams,
    currentWeek,
    finalWeek: dynasty.season.schedule.reduce((max, g) => Math.max(max, g.week), 0),
  };
}

/** A recruit in a two-school race: us and one rival, both offering half rides. */
function race(state: WeekSimState, ours: number, theirs: number, stars: LacrosseRecruit['starRating'] = 3): { recruit: LacrosseRecruit; rivalId: string } {
  const { dynasty } = state;
  const rivalId = dynasty.season.teams.find((t) => t.id !== dynasty.userTeamId)!.id;
  const base = dynasty.recruits.find((r) => r.status === 'open')!;
  return {
    rivalId,
    recruit: {
      ...base,
      starRating: stars,
      scholarshipOffers: [
        { teamId: dynasty.userTeamId, scholarshipPercent: 50 },
        { teamId: rivalId, scholarshipPercent: 50 },
      ],
      interestByTeamId: { [dynasty.userTeamId]: ours, [rivalId]: theirs },
    } as LacrosseRecruit,
  };
}

describe('chance to land', () => {
  it('labels probabilities in plain words', () => {
    expect(landLabel(0.8)).toBe('Likely');
    expect(landLabel(0.45)).toBe('Toss-up');
    expect(landLabel(0.1)).toBe('Long shot');
  });

  it('reads interest as a race, not a chance: 100 vs 100 on decision day is no lock', () => {
    const state = freshState(1_000);
    const { recruit } = race(state, 100, 100);
    const chance = landChance(recruit, contextOf(state, 30))!;
    expect(chance.label).not.toBe('Likely');
    expect(chance.leaderTeamId).toBeDefined();
    expect(chance.detail).toMatch(/Level with/);
  });

  it('favors a clear leader and writes off a recruit far behind a rival late in the race', () => {
    const state = freshState(1_000);
    const ahead = landChance(race(state, 90, 50).recruit, contextOf(state, 30))!;
    const behind = landChance(race(state, 40, 95).recruit, contextOf(state, 30))!;
    expect(ahead.label).toBe('Likely');
    expect(behind.label).toBe('Long shot');
    expect(behind.detail).toMatch(/leads us by 55/);
  });

  it('leaves more room to catch up early in the season than on decision day', () => {
    const state = freshState(1_000);
    const { recruit } = race(state, 30, 50);
    const early = landChance(recruit, contextOf(state, 1))!;
    const late = landChance(recruit, contextOf(state, 30))!;
    expect(early.probability).toBeGreaterThan(late.probability);
  });

  it('marks odds on recruits we have not offered as hypothetical', () => {
    const state = freshState(1_000);
    const { recruit, rivalId } = race(state, 0, 20);
    const unoffered = { ...recruit, scholarshipOffers: recruit.scholarshipOffers.filter((o) => o.teamId === rivalId) };
    const chance = landChance(unoffered, contextOf(state))!;
    expect(chance.hypothetical).toBe(true);
    expect(chance.detail).toMatch(/^If you offer \d+%/);
  });

  it('expects a suitor for an unoffered blue-chip, so a five-star is no sure thing', () => {
    const state = freshState(1_000);
    const { recruit } = race(state, 0, 0, 5);
    const fiveStar = { ...recruit, scholarshipOffers: [] };
    const twoStar = { ...recruit, starRating: 2 as const, scholarshipOffers: [] };
    const ctx = contextOf(state, 0);
    expect(landChance(fiveStar, ctx)!.probability).toBeLessThan(landChance(twoStar, ctx)!.probability);
    expect(landChance(twoStar, ctx)!.label).toBe('Likely');
  });

  it('skips recruits who are off the market', () => {
    const state = freshState(1_000);
    const { recruit, rivalId } = race(state, 50, 50);
    expect(landChance({ ...recruit, status: 'committed', committedTeamId: rivalId }, contextOf(state))).toBeUndefined();
  });

  it('Best for Us discounts long shots below attainable targets', () => {
    const state = freshState(1_000);
    const ctx = contextOf(state, 30);
    const longShot = landChance(race(state, 20, 95).recruit, ctx);
    const likely = landChance(race(state, 95, 20).recruit, ctx);
    expect(attainableBoardScore(80, longShot)).toBeLessThan(attainableBoardScore(60, likely));
    expect(attainableBoardScore(80, undefined)).toBe(80);
  });

  it('is calibrated: Likely recruits sign with us far more often than Long shots', () => {
    const tally = { Likely: { n: 0, won: 0 }, 'Toss-up': { n: 0, won: 0 }, 'Long shot': { n: 0, won: 0 } };
    for (let seed = 1; seed <= 4; seed += 1) {
      const random = seededRandom(seed);
      let state = freshState(seed * 1000);
      // Every week's label for a recruit we offered counts once, judged by where he signed.
      const labels = new Map<string, Array<keyof typeof tally>>();
      for (let w = 0; w < 12; w += 1) {
        state = applyAssistantToWeekState(state, [], random, { autoOffer: true }).state;
        const ctx = contextOf(state);
        for (const r of state.dynasty.recruits) {
          if (!r.scholarshipOffers.some((o) => o.teamId === state.dynasty.userTeamId)) continue;
          const chance = landChance(r, ctx);
          if (chance) labels.set(r.id, [...(labels.get(r.id) ?? []), chance.label]);
        }
        state = simulateOneWeek(state, undefined, random);
      }
      for (const r of state.dynasty.recruits) {
        if (r.status === 'open') continue;
        const won = r.committedTeamId === state.dynasty.userTeamId || r.signedTeamId === state.dynasty.userTeamId;
        for (const label of labels.get(r.id) ?? []) {
          tally[label].n += 1;
          tally[label].won += won ? 1 : 0;
        }
      }
    }
    const rate = (label: keyof typeof tally) => tally[label].won / Math.max(1, tally[label].n);
    expect(tally.Likely.n).toBeGreaterThan(5);
    expect(tally['Long shot'].n).toBeGreaterThan(5);
    expect(rate('Likely')).toBeGreaterThan(0.6);
    expect(rate('Long shot')).toBeLessThan(0.35);
    expect(rate('Likely')).toBeGreaterThan(rate('Toss-up'));
    expect(rate('Toss-up')).toBeGreaterThan(rate('Long shot'));
  }, 60_000);
});
