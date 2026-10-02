import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFreshLacrosseDynasty } from './dynasty-factory';
import { backfillWalkOns, enforceRosterLimit, resolveAndApplyPortal, ROSTER_FLOOR, ROSTER_LIMIT, runOffseason } from './dynasty-helpers';
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
  // Player development and box-score stats draw from Math.random; pin it so
  // the run is the same on every machine.
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // A five-year run caught rosters shrinking ~3 players a season (42 -> 33)
  // because the recruit pool was smaller than each year's graduating class.
  it('keeps rosters full season after season', () => {
    vi.spyOn(Math, 'random').mockImplementation(seededRandom(99));
    let dynasty = createFreshLacrosseDynasty({ now: () => 4_242 });
    const random = seededRandom(17);
    const averages: number[] = [];
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
      const offseason = runOffseason(finished.dynasty, undefined, 'balanced', finished.seasonStats);
      // The season's rosters are what's left once the transfer portal settles.
      const { dynasty: newDynasty } = resolveAndApplyPortal(offseason.newDynasty);
      const nextYear = newDynasty.season.year;
      const sizes = newDynasty.season.teams.map((t) => t.roster.length);
      const signed = newDynasty.season.teams.flatMap((t) =>
        t.roster.filter((p) => p.createdSeason === nextYear && !p.isWalkOn),
      ).length;

      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(ROSTER_FLOOR);
      const cpuSizes = newDynasty.season.teams.filter((t) => t.id !== newDynasty.userTeamId).map((t) => t.roster.length);
      expect(Math.max(...cpuSizes)).toBeLessThanOrEqual(ROSTER_LIMIT);
      // The first class is light (no prior recruiting cycle), so the league
      // averages about 40 after year one and grows from there.
      const average = sizes.reduce((a, b) => a + b, 0) / sizes.length;
      averages.push(average);
      expect(average).toBeGreaterThan(ROSTER_FLOOR + 1);
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
    // Rosters must not erode: the last season is at least as full as the first.
    expect(averages.at(-1)!).toBeGreaterThanOrEqual(averages[0]!);
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

  it('holds walk-on tryouts at a missing position even when the roster is full', () => {
    const dynasty = createFreshLacrosseDynasty({ now: () => 9 });
    const team = dynasty.season.teams[0]!;
    const fieldPlayers = team.roster.filter((p) => p.position !== 'FOGO');
    const fillers = Array.from({ length: Math.max(0, ROSTER_FLOOR + 2 - fieldPlayers.length) }, (_, i) => ({
      ...fieldPlayers[0]!,
      id: `filler-${i}`,
    }));
    const noFaceoffMan = { ...team, roster: [...fieldPlayers, ...fillers] };
    expect(noFaceoffMan.roster.length).toBeGreaterThan(ROSTER_FLOOR);

    const filled = backfillWalkOns(noFaceoffMan, dynasty.rosterTargets, 1, 2027);
    const added = filled.roster.filter((p) => !noFaceoffMan.roster.includes(p));
    expect(added.map((p) => p.position)).toEqual(['FOGO']);
    expect(added[0]!.isWalkOn).toBe(true);
    // A roster with everything it needs is left alone.
    expect(backfillWalkOns(filled, dynasty.rosterTargets, 1, 2027)).toBe(filled);
  });
});
