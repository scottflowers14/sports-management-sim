import { describe, expect, it } from 'vitest';
import { createFreshLacrosseDynasty } from './dynasty-factory';
import { createScoutingState } from './scouting';
import { emptyRecruitingActivity } from './recruiting-activity';
import { emptySeasonStats } from './stats';
import { simulateRemainingWeeks, type WeekSimState } from './week-sim';
import { runOffseason } from './dynasty-helpers';
import type { LacrosseDynastyState } from '@sports-management-sim/sport-lacrosse';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function simState(dynasty: LacrosseDynastyState): WeekSimState {
  return {
    dynasty,
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

/**
 * League-health regression tests: with a completely idle user, CPU programs
 * must still recruit sensibly enough that the league doesn't hollow out over a
 * multi-season dynasty.
 */
describe('CPU recruiting league health (idle user)', () => {
  it('keeps every roster at or near the floor across two idle seasons and stratifies recruits by prestige', () => {
    let dynasty = createFreshLacrosseDynasty({ now: () => 424242 });

    for (let season = 1; season <= 2; season++) {
      const done = simulateRemainingWeeks(simState(dynasty), undefined, seededRandom(1000 + season));

      if (season === 1) {
        // Blue-chips land at markedly stronger programs than depth recruits.
        const teams = done.dynasty.season.teams;
        const prestigeOf = (id?: string) => teams.find((t) => t.id === id)?.reputation.nationalPrestige;
        const avgDestination = (minStar: number, maxStar: number) => {
          const prestiges = done.dynasty.recruits
            .filter((r) => r.starRating >= minStar && r.starRating <= maxStar && r.status !== 'open')
            .map((r) => prestigeOf(r.committedTeamId ?? r.signedTeamId))
            .filter((p): p is number => p !== undefined);
          return prestiges.reduce((s, p) => s + p, 0) / Math.max(1, prestiges.length);
        };
        expect(avgDestination(4, 5)).toBeGreaterThan(avgDestination(1, 2) + 5);

        // The attainability-weighted boards spread offers well beyond the Top 100.
        const offered = done.dynasty.recruits.filter((r) => r.scholarshipOffers.length > 0).length;
        expect(offered).toBeGreaterThan(done.dynasty.recruits.length * 0.5);
      }

      const { newDynasty } = runOffseason(done.dynasty, undefined, 'balanced', done.seasonStats);

      for (const team of newDynasty.season.teams) {
        // Walk-on backfill guarantees a playable roster even after a whiffed class...
        expect(team.roster.length).toBeGreaterThanOrEqual(30);
        // ...and the projected-size guard keeps classes from blowing past the cap.
        expect(team.roster.length).toBeLessThanOrEqual(47);
        expect(team.roster.some((p) => p.position === 'GK')).toBe(true);
        expect(team.roster.some((p) => p.position === 'FOGO')).toBe(true);
      }

      // Bottom-prestige programs actually sign players now that offer slots
      // recycle and boards are attainability-weighted.
      const newYear = newDynasty.season.year;
      const byPrestige = [...newDynasty.season.teams]
        .filter((t) => t.id !== newDynasty.userTeamId)
        .sort((a, b) => b.reputation.nationalPrestige - a.reputation.nationalPrestige);
      const bottomSix = byPrestige.slice(-6);
      const bottomSixSignings = bottomSix.reduce(
        (sum, t) => sum + t.roster.filter((p) => p.createdSeason === newYear && p.classYear === 'FR' && !p.isWalkOn).length,
        0,
      );
      expect(bottomSixSignings).toBeGreaterThanOrEqual(6);

      dynasty = newDynasty;
    }
  });
});
