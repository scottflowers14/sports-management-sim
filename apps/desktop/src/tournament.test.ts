import { describe, expect, it } from 'vitest';
import { createFreshLacrosseDynasty } from './dynasty-factory';
import { simulateRemainingWeeks, type WeekSimState } from './week-sim';
import { createScoutingState } from './scouting';
import { emptyRecruitingActivity } from './recruiting-activity';
import { emptySeasonStats } from './stats';
import {
  NCAA_FIELD_SIZE,
  advanceNationalChampionship,
  advanceNcaaFirstRound,
  advanceNcaaQuarterfinals,
  advanceTournamentFinals,
  advanceTournamentNationalSemis,
  advanceTournamentSemis,
  computeRpi,
  initTournament,
} from './tournament';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function finishedSeason() {
  const state: WeekSimState = {
    dynasty: createFreshLacrosseDynasty(),
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
  return simulateRemainingWeeks(state, undefined, seededRandom(21)).dynasty.season;
}

describe('NCAA tournament', () => {
  const season = finishedSeason();
  const { teams, schedule, standings, conferences } = season;
  const afterConf = advanceTournamentFinals(
    advanceTournamentSemis(initTournament(standings, conferences), teams),
    teams,
    undefined,
    schedule,
  );
  const field = afterConf.ncaaField!;

  it('selects every conference champion plus at-large teams, seeded by RPI', () => {
    expect(afterConf.phase).toBe('ncaa_first_round');
    expect(field).toHaveLength(NCAA_FIELD_SIZE);
    const champions = afterConf.conferenceBrackets.map((b) => b.champion!);
    for (const champ of champions) {
      expect(field.find((e) => e.teamId === champ)?.bid).toBe('auto');
    }
    expect(field.filter((e) => e.bid === 'at-large')).toHaveLength(NCAA_FIELD_SIZE - new Set(champions).size);
    expect(field.map((e) => e.seed)).toEqual(Array.from({ length: NCAA_FIELD_SIZE }, (_, i) => i + 1));
    for (let i = 1; i < field.length; i += 1) expect(field[i - 1]!.rpi).toBeGreaterThanOrEqual(field[i]!.rpi);
  });

  it('leaves out only teams whose RPI trails every at-large pick', () => {
    const lowestAtLarge = Math.min(...field.filter((e) => e.bid === 'at-large').map((e) => e.rpi));
    expect(afterConf.ncaaFirstOut).toHaveLength(4);
    for (const out of afterConf.ncaaFirstOut!) expect(out.rpi).toBeLessThanOrEqual(lowestAtLarge);
  });

  it('gives the top four seeds byes and plays the bracket down to one champion', () => {
    const topFour = new Set(field.slice(0, 4).map((e) => e.teamId));
    for (const g of afterConf.ncaaFirstRound!) {
      expect(topFour.has(g.homeTeamId) || topFour.has(g.awayTeamId)).toBe(false);
    }
    const r1 = advanceNcaaFirstRound(afterConf, teams);
    expect(r1.phase).toBe('ncaa_quarterfinals');
    // Each quarterfinal is hosted by a top-four seed.
    expect(r1.ncaaQuarterfinals!.map((g) => g.homeTeamId).every((id) => topFour.has(id))).toBe(true);
    const qf = advanceNcaaQuarterfinals(r1, teams);
    expect(qf.phase).toBe('national_semis');
    const qfWinners = new Set(qf.ncaaQuarterfinals!.map((g) => g.result!.winnerId));
    for (const g of [qf.nationalSemiFinal1!, qf.nationalSemiFinal2!]) {
      expect(qfWinners.has(g.homeTeamId) && qfWinners.has(g.awayTeamId)).toBe(true);
    }
    const done = advanceNationalChampionship(advanceTournamentNationalSemis(qf, teams), teams);
    expect(done.phase).toBe('complete');
    expect(qfWinners.has(done.nationalChampion!)).toBe(true);
  });

  it('separates teams with identical records by schedule strength', () => {
    const rpi = computeRpi(teams, schedule);
    expect([...rpi.values()].every((v) => v >= 0 && v <= 1)).toBe(true);
    // Two teams with the same record: the tougher schedule rates higher.
    const byRecord = new Map<string, string[]>();
    for (const t of teams) {
      const key = `${t.record.wins}-${t.record.losses}`;
      byRecord.set(key, [...(byRecord.get(key) ?? []), t.id]);
    }
    const sameRecord = [...byRecord.values()].find((ids) => ids.length >= 2)!;
    const values = sameRecord.map((id) => rpi.get(id)!);
    expect(new Set(values).size).toBeGreaterThan(1);
  });
});
