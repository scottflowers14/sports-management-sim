import { describe, expect, it } from 'vitest';
import { createNewLacrosseDynasty } from '@sports-management-sim/sport-lacrosse';
import { ALL_AMERICA_SLOTS, ALL_AMERICA_TIERS, computeSeasonAwards, programAllAmericans } from './awards';
import { toAllAmericaRecords } from './history';
import { createScoutingState } from './scouting';
import { emptyRecruitingActivity } from './recruiting-activity';
import { emptySeasonStats, type SeasonStatsMap } from './stats';
import { simulateRemainingWeeks, type WeekSimState } from './week-sim';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function playedSeason() {
  const dynasty = createNewLacrosseDynasty({ seed: 7, userTeamId: 'maryland-state', seasonYear: 2028 });
  const state = {
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
  } as unknown as WeekSimState;
  const done = simulateRemainingWeeks(state, undefined, seededRandom(5));
  return { season: done.dynasty.season, stats: done.seasonStats as SeasonStatsMap };
}

describe('All-America teams', () => {
  const { season, stats } = playedSeason();
  const awards = computeSeasonAwards(season, 'maryland-state', stats);
  const teams = awards.allAmerica!;

  it('seats twelve players a team, by position, with nobody named twice', () => {
    const ids = ALL_AMERICA_TIERS.flatMap((tier) => teams[tier].map((w) => w.playerId));
    expect(new Set(ids).size).toBe(ids.length);
    for (const tier of ALL_AMERICA_TIERS) {
      expect(teams[tier]).toHaveLength(12);
      for (const [position, seats] of ALL_AMERICA_SLOTS) {
        expect(teams[tier].filter((w) => w.position === position)).toHaveLength(seats);
      }
    }
  });

  it('ranks the first team ahead of the second', () => {
    // Production, leaned a little toward winning teams.
    const winPct = new Map(season.teams.map((t) => [t.id, t.record.wins / Math.max(1, t.record.wins + t.record.losses)]));
    const vote = (w: { playerId?: string; teamId?: string }) =>
      ((stats[w.playerId!]?.goals ?? 0) + (stats[w.playerId!]?.assists ?? 0)) * (0.8 + 0.4 * winPct.get(w.teamId!)!);
    const worstFirst = Math.min(...teams.first.filter((w) => w.position === 'ATT').map(vote));
    const bestSecond = Math.max(...teams.second.filter((w) => w.position === 'ATT').map(vote));
    expect(worstFirst).toBeGreaterThanOrEqual(bestSecond);
    expect(teams.first.every((w) => w.statLine !== undefined)).toBe(true);
  });

  it('lists a program’s All-Americans best tier first, for history', () => {
    const programId = teams.first[0]!.teamId!;
    const ours = programAllAmericans(teams, programId);
    expect(ours.length).toBeGreaterThan(0);
    expect(ours.every((a) => a.winner.teamId === programId)).toBe(true);
    const order = ours.map((a) => ALL_AMERICA_TIERS.indexOf(a.tier));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    const records = toAllAmericaRecords(awards, programId);
    expect(records).toHaveLength(ours.length);
    expect(records[0]!.award).toBe('1st Team All-America');
    expect(programAllAmericans(undefined, programId)).toEqual([]);
  });

  it('falls back to ratings before any games are played', () => {
    const fresh = createNewLacrosseDynasty({ seed: 7, userTeamId: 'maryland-state', seasonYear: 2028 }).season;
    const byRating = computeSeasonAwards(fresh, 'maryland-state').allAmerica!;
    expect(byRating.first).toHaveLength(12);
    const att = (tier: 'first' | 'second') => byRating[tier].filter((w) => w.position === 'ATT').map((w) => w.overall);
    expect(Math.min(...att('first'))).toBeGreaterThanOrEqual(Math.max(...att('second')));
  });
});
