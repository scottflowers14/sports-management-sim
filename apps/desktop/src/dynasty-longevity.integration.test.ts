import { describe, expect, it } from 'vitest';
import { createFreshLacrosseDynasty } from './dynasty-factory';
import { enforceRosterLimit, ROSTER_FLOOR, ROSTER_LIMIT, runOffseason } from './dynasty-helpers';
import { emptyRecruitingActivity } from './recruiting-activity';
import { createScoutingState } from './scouting';
import { emptySeasonStats } from './stats';
import { simulateRemainingWeeks, type WeekSimState } from './week-sim';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function weekState(dynasty: WeekSimState['dynasty']): WeekSimState {
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

describe('long dynasties', () => {
  // A five-year run caught rosters shrinking ~3 players a season (42 -> 33)
  // because the recruit pool was smaller than each year's graduating class.
  it('keeps rosters full season after season', () => {
    let dynasty = createFreshLacrosseDynasty({ now: () => 4_242 });
    const random = seededRandom(17);
    const leagueMean = (d: typeof dynasty) => {
      const players = d.season.teams.flatMap((t) => t.roster);
      return players.reduce((sum, p) => sum + p.ratings.overall, 0) / players.length;
    };
    const startMean = leagueMean(dynasty);
    for (let year = 0; year < 5; year += 1) {
      const finished = simulateRemainingWeeks(weekState(dynasty), undefined, random);
      const graduating = finished.dynasty.season.teams.flatMap((t) =>
        t.roster.filter((p) => p.classYear === 'SR' || p.classYear === 'GR'),
      ).length;
      const { newDynasty } = runOffseason(finished.dynasty, undefined, 'balanced', finished.seasonStats);
      const nextYear = newDynasty.season.year;
      const sizes = newDynasty.season.teams.map((t) => t.roster.length);
      const signed = newDynasty.season.teams.flatMap((t) =>
        t.roster.filter((p) => p.createdSeason === nextYear && !p.isWalkOn),
      ).length;

      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(ROSTER_FLOOR);
      const cpuSizes = newDynasty.season.teams.filter((t) => t.id !== newDynasty.userTeamId).map((t) => t.roster.length);
      expect(Math.max(...cpuSizes)).toBeLessThanOrEqual(ROSTER_LIMIT);
      expect(sizes.reduce((a, b) => a + b, 0) / sizes.length).toBeGreaterThan(40);
      // After the first cycle, signing classes replace most of the graduates.
      if (year > 0) expect(signed).toBeGreaterThan(graduating * 0.8);
      // Starting rosters match the talent that recruiting and development
      // sustain, so the league doesn't inflate (it once climbed ~4 points in 6 years).
      expect(Math.abs(leagueMean(newDynasty) - startMean)).toBeLessThan(2);
      // Every returning player carries an end-of-season rating for the year just played.
      const returning = newDynasty.season.teams.flatMap((t) => t.roster.filter((p) => p.createdSeason < nextYear));
      expect(returning.every((p) => p.ratingHistory?.at(-1)?.season === nextYear - 1)).toBe(true);
      const prestige = newDynasty.season.teams.map((t) => t.reputation.nationalPrestige);
      expect(Math.max(...prestige)).toBeLessThanOrEqual(92);
      dynasty = newDynasty;
    }
  }, 120_000);

  it('cuts walk-ons first and keeps position minimums when over the limit', () => {
    const team = createFreshLacrosseDynasty({ now: () => 9 }).season.teams[0]!;
    const goalies = team.roster.filter((p) => p.position === 'GK').slice(0, 2);
    const padded = {
      ...team,
      roster: [
        ...team.roster.filter((p) => p.position !== 'GK'),
        ...goalies,
        ...Array.from({ length: 12 }, (_, i) => ({ ...team.roster[0]!, id: `walk-${i}`, isWalkOn: true })),
      ],
    };
    const trimmed = enforceRosterLimit(padded);
    expect(trimmed.roster).toHaveLength(ROSTER_LIMIT);
    expect(trimmed.roster.filter((p) => p.position === 'GK')).toHaveLength(2);
    const cut = padded.roster.filter((p) => !trimmed.roster.includes(p));
    expect(cut.length).toBeGreaterThan(0);
    expect(cut.every((p) => p.isWalkOn)).toBe(true);
  });
});
