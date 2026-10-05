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
  ncaaFieldSize,
  projectNcaaField,
  bracketMovementHeadline,
  type NcaaProjection,
  projectionStatus,
  compareConferenceStanding,
  selectNcaaField,
  selectionResumes,
  atLargeEligible,
  RESUME_GAME_WEIGHT,
  advanceTournamentPhase,
  teamGameThisRound,
  tournamentGames,
  withTournamentCoaching,
} from './tournament';
import { deriveCpuGamePlan } from '@sports-management-sim/sport-lacrosse';

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

  it('selects every conference champion plus at-large teams, seeded by resume', () => {
    expect(afterConf.phase).toBe('ncaa_first_round');
    expect(field).toHaveLength(NCAA_FIELD_SIZE);
    const champions = afterConf.conferenceBrackets.map((b) => b.champion!);
    for (const champ of champions) {
      expect(field.find((e) => e.teamId === champ)?.bid).toBe('auto');
    }
    expect(field.filter((e) => e.bid === 'at-large')).toHaveLength(NCAA_FIELD_SIZE - new Set(champions).size);
    expect(field.map((e) => e.seed)).toEqual(Array.from({ length: NCAA_FIELD_SIZE }, (_, i) => i + 1));
    const score = (e: { rpi: number; qualityWins?: number; badLosses?: number }) =>
      e.rpi + RESUME_GAME_WEIGHT * ((e.qualityWins ?? 0) - (e.badLosses ?? 0));
    for (let i = 1; i < field.length; i += 1) expect(score(field[i - 1]!)).toBeGreaterThanOrEqual(score(field[i]!));
  });

  it('leaves out only teams whose resume trails every at-large pick', () => {
    const score = (e: { rpi: number; qualityWins?: number; badLosses?: number }) =>
      e.rpi + RESUME_GAME_WEIGHT * ((e.qualityWins ?? 0) - (e.badLosses ?? 0));
    const lowestAtLarge = Math.min(...field.filter((e) => e.bid === 'at-large').map(score));
    expect(afterConf.ncaaFirstOut).toHaveLength(4);
    for (const out of afterConf.ncaaFirstOut!) expect(score(out)).toBeLessThanOrEqual(lowestAtLarge);
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

describe('conference tournament seeding', () => {
  it('seeds by conference record before overall record', () => {
    const base = { ...finishedSeason().teams[0]!.record, wins: 0, losses: 0, conferenceWins: 0, conferenceLosses: 0 };
    const entry = (teamId: string, conferenceWins: number, conferenceLosses: number, wins: number, losses: number) => ({
      teamId,
      conferenceId: 'c',
      record: { ...base, conferenceWins, conferenceLosses, wins, losses },
      pointsFor: 0,
      pointsAgainst: 0,
      strengthOfSchedule: 0,
      rankingScore: 0,
    });
    const confStandings = [
      entry('nonconf-hero', 2, 3, 7, 3), // best overall record, poor in the league
      entry('league-champ', 5, 0, 6, 4),
      entry('runner-up', 4, 1, 4, 6),
      entry('third', 3, 2, 5, 5),
      entry('fifth', 1, 4, 2, 8),
    ];
    const conf = { id: 'c', name: 'C', shortName: 'C', prestige: 50, teamIds: confStandings.map((e) => e.teamId), regionIds: [] };
    const bracket = initTournament(confStandings, [conf]).conferenceBrackets[0]!;
    expect(bracket.seeds).toEqual(['league-champ', 'runner-up', 'third', 'nonconf-hero']);
  });
});

describe('ncaaFieldSize', () => {
  it('sizes the field to the bracket a league can actually play', () => {
    expect(ncaaFieldSize(36)).toBe(NCAA_FIELD_SIZE);
    expect(ncaaFieldSize(12)).toBe(NCAA_FIELD_SIZE);
    expect(ncaaFieldSize(8)).toBe(4);
    expect(ncaaFieldSize(3)).toBe(3);
  });

  it('gives an eight-team league a four-team field and a real first-out list', () => {
    const { teams, schedule } = finishedSeason();
    const small = teams.slice(0, 8);
    const smallIds = new Set(small.map((t) => t.id));
    const smallSchedule = schedule.filter((g) => smallIds.has(g.homeTeamId) && smallIds.has(g.awayTeamId));
    const { field, firstOut } = selectNcaaField([small[0]!.id, small[1]!.id], small, smallSchedule);
    expect(field).toHaveLength(4);
    expect(field.filter((e) => e.bid === 'auto')).toHaveLength(2);
    expect(firstOut).toHaveLength(4);
  });
});

describe('coached tournament games', () => {
  const season = finishedSeason();
  const { teams, schedule, standings, conferences } = season;
  const coaching = () => ({ offense: 0, defense: 0 });

  it('replays the coached first half in every round and changes only the second', () => {
    let state = initTournament(standings, conferences);
    let rounds = 0;
    while (state.phase !== 'complete') {
      // Coach the home side of one of this round's games.
      const probe = advanceTournamentPhase(state, teams, deriveCpuGamePlan, schedule, coaching);
      const playedBefore = new Set(tournamentGames(state).filter((g) => g.result).map((g) => g.id));
      const teamId = tournamentGames(probe).find((g) => g.result && !playedBefore.has(g.id))!.homeTeamId;
      const half = (log: { events: { period: unknown }[] } | undefined) => log!.events.filter((e) => e.period === 1 || e.period === 2);
      const preview = withTournamentCoaching({ teamId, seed: 77 }, () => advanceTournamentPhase(state, teams, deriveCpuGamePlan, schedule, coaching));
      const played = withTournamentCoaching({ teamId, seed: 77, secondHalfPlan: { tempo: 'uptempo', defense: 'pressure', ride: 'aggressive', rotation: 'deep' } }, () =>
        advanceTournamentPhase(state, teams, deriveCpuGamePlan, schedule, coaching),
      );
      const previewGame = teamGameThisRound(state, preview, teamId);
      const playedGame = teamGameThisRound(state, played, teamId);
      if (previewGame && playedGame) {
        expect(playedGame.id).toBe(previewGame.id);
        expect(half(playedGame.result!.log)).toEqual(half(previewGame.result!.log));
        rounds += 1;
      }
      state = played;
    }
    expect(rounds).toBeGreaterThanOrEqual(4);
  });
});

describe('bracketology', () => {
  const season = finishedSeason();
  const { teams, schedule, standings, conferences } = season;
  const projection = projectNcaaField(teams, conferences, standings, schedule);

  it('gives each conference leader the projected auto bid', () => {
    for (const conf of conferences) {
      const leader = [...standings].filter((s) => conf.teamIds.includes(s.teamId)).sort(compareConferenceStanding)[0]!;
      expect(projection.leaders.get(conf.id)).toBe(leader.teamId);
      expect(projection.field.find((e) => e.teamId === leader.teamId)?.bid).toBe('auto');
    }
    expect(projection.field).toHaveLength(NCAA_FIELD_SIZE);
  });

  it('describes in, bubble and out teams', () => {
    const inTeam = projection.field[0]!;
    expect(projectionStatus(projection, inTeam.teamId)).toMatch(/^Projected #1 seed \((auto bid|at-large)\)$/);
    expect(projectionStatus(projection, projection.firstOut[0]!.teamId)).toBe('First four out (#1)');
    const listed = new Set([...projection.field, ...projection.firstOut].map((e) => e.teamId));
    const out = teams.find((t) => !listed.has(t.id))!;
    expect(projectionStatus(projection, out.id)).toBe(`Out of the field (RPI #${projection.rpiRank.get(out.id)})`);
    expect([...projection.rpiRank.values()].sort((a, b) => a - b)).toEqual(teams.map((_, i) => i + 1));
  });
});

describe('bubble watch headlines', () => {
  const projection = (field: Array<[string, number]>, firstOut: string[] = []): NcaaProjection => ({
    field: field.map(([teamId, seed]) => ({ teamId, seed, bid: 'at-large' as const, rpi: 0.5 })),
    firstOut: firstOut.map((teamId) => ({ teamId, rpi: 0.4 })),
    leaders: new Map(),
    rpiRank: new Map(),
  });

  it('reports moving into and out of the field', () => {
    expect(bracketMovementHeadline(projection([]), projection([['us', 9]]), 'us', 'Us')).toBe(
      'Bubble watch: Us plays its way into the projected NCAA field as the #9 seed',
    );
    expect(bracketMovementHeadline(projection([['us', 12]]), projection([], ['us']), 'us', 'Us')).toBe(
      'Bubble watch: Us falls out of the projected NCAA field and into the first four out',
    );
    expect(bracketMovementHeadline(projection([['us', 12]]), projection([]), 'us', 'Us')).toBe(
      'Bubble watch: Us falls out of the projected NCAA field',
    );
  });

  it('reports seed swings of three or more and stays quiet otherwise', () => {
    expect(bracketMovementHeadline(projection([['us', 8]]), projection([['us', 4]]), 'us', 'Us')).toBe(
      'Bracketology: Us climbs from a projected #8 to a #4 seed',
    );
    expect(bracketMovementHeadline(projection([['us', 2]]), projection([['us', 6]]), 'us', 'Us')).toMatch(/slides from a projected #2 to a #6/);
    expect(bracketMovementHeadline(projection([['us', 5]]), projection([['us', 3]]), 'us', 'Us')).toBeNull();
    expect(bracketMovementHeadline(projection([]), projection([]), 'us', 'Us')).toBeNull();
  });
});

describe('selection committee resume', () => {
  const season = finishedSeason();
  const template = season.schedule.find((g) => g.status === 'final' && g.result)!;
  const teams = season.teams.slice(0, 8).map((t) => ({ ...t, record: { ...t.record, wins: 0, losses: 0 } }));
  const [a, b, c, d, e, f, g, h] = teams.map((t) => t.id) as [string, string, string, string, string, string, string, string];
  let n = 0;
  const game = (winner: string, loser: string) => ({
    ...template,
    id: `syn-${n++}`,
    homeTeamId: winner,
    awayTeamId: loser,
    status: 'final' as const,
    result: { ...template.result!, winnerTeamId: winner, loserTeamId: loser },
  });
  // a sweeps the league; h loses everything.
  const schedule = [
    game(a, b), game(a, c), game(a, d), game(a, h),
    game(b, c), game(b, d), game(h, b),
    game(c, d), game(c, e), game(f, c),
    game(e, f), game(e, g), game(d, e),
    game(f, g), game(g, h), game(f, h),
  ];
  for (const s of schedule) {
    const w = teams.find((t) => t.id === s.result.winnerTeamId)!;
    const l = teams.find((t) => t.id === s.result.loserTeamId)!;
    w.record.wins += 1;
    l.record.losses += 1;
  }

  it('counts quality wins over the top quarter and bad losses to the bottom half', () => {
    const resumes = selectionResumes(teams, schedule);
    const rpi = computeRpi(teams, schedule);
    const order = [...rpi.entries()].sort((x, y) => y[1] - x[1]).map(([id]) => id);
    const top = new Set(order.slice(0, 2));
    const bottom = new Set(order.slice(4));
    for (const t of teams) {
      const r = resumes.get(t.id)!;
      const wins = schedule.filter((s) => s.result.winnerTeamId === t.id);
      const losses = schedule.filter((s) => s.result.loserTeamId === t.id);
      expect(r.qualityWins).toBe(wins.filter((s) => top.has(s.result.loserTeamId)).length);
      expect(r.badLosses).toBe(losses.filter((s) => bottom.has(s.result.winnerTeamId)).length);
      expect(r.score).toBeCloseTo(r.rpi + RESUME_GAME_WEIGHT * (r.qualityWins - r.badLosses));
    }
    // b's loss to winless-but-for-one h is a bad loss.
    expect(resumes.get(b)!.badLosses).toBeGreaterThanOrEqual(1);
  });

  it('keeps losing teams out of at-large spots and seeds by resume', () => {
    const { field } = selectNcaaField([h], teams, schedule);
    const atLarge = field.filter((x) => x.bid === 'at-large');
    expect(atLarge).toHaveLength(3);
    for (const x of atLarge) expect(atLargeEligible(teams.find((y) => y.id === x.teamId)!)).toBe(true);
    const resumes = selectionResumes(teams, schedule);
    const scores = field.map((x) => resumes.get(x.teamId)!.score);
    expect(scores).toEqual([...scores].sort((x, y) => y - x));
    expect(field.every((x) => x.qualityWins !== undefined && x.badLosses !== undefined)).toBe(true);
  });

  it('fills the bracket with losing teams only when it has to', () => {
    // Everyone below .500 but the champion: the field still fills.
    const losers = teams.map((t) => ({ ...t, record: { ...t.record, wins: 1, losses: 5 } }));
    const { field } = selectNcaaField([a], losers, schedule);
    expect(field).toHaveLength(4);
  });
});
