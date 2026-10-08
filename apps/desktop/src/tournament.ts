import { deriveCpuGamePlan, simulateLacrosseGameWithLog } from '@sports-management-sim/sport-lacrosse';
import type { CoachingEdge, GameLog, LacrosseGamePlan, LacrosseTeam, LacrosseTeamStats } from '@sports-management-sim/sport-lacrosse';
import type { Conference, ScheduledGame, StandingsEntry } from '@sports-management-sim/engine-core';
import { seededGameRandom } from './halftime';

/** Resolves the game plan a team uses in tournament play (defaults to CPU-derived plans). */
export type GamePlanResolver = (team: LacrosseTeam) => LacrosseGamePlan;
export type CoachingResolver = (team: LacrosseTeam) => CoachingEdge;
const NO_COACHING: CoachingResolver = () => ({ offense: 0, defense: 0 });

/** The user's postseason game, coached through halftime (see halftime.ts). */
export interface TournamentCoaching {
  teamId: string;
  seed: number;
  secondHalfPlan?: LacrosseGamePlan;
}

let activeCoaching: TournamentCoaching | null = null;

/**
 * Runs a tournament step with the coached team's game on seeded dice. Must
 * wrap a synchronous call, never a React state updater that runs later.
 */
export function withTournamentCoaching<T>(coaching: TournamentCoaching, run: () => T): T {
  activeCoaching = coaching;
  try {
    return run();
  } finally {
    activeCoaching = null;
  }
}

/** Plays whatever round the tournament is on. */
export function advanceTournamentPhase(
  state: TournamentState,
  teams: LacrosseTeam[],
  planFor: GamePlanResolver,
  schedule: ScheduledGame[],
  coachingFor: CoachingResolver,
): TournamentState {
  switch (state.phase) {
    case 'conf_semis':
      return advanceTournamentSemis(state, teams, planFor, coachingFor);
    case 'conf_finals':
      return advanceTournamentFinals(state, teams, planFor, schedule, coachingFor);
    case 'ncaa_first_round':
      return advanceNcaaFirstRound(state, teams, planFor, coachingFor);
    case 'ncaa_quarterfinals':
      return advanceNcaaQuarterfinals(state, teams, planFor, coachingFor);
    case 'national_semis':
      return advanceTournamentNationalSemis(state, teams, planFor, coachingFor);
    case 'national_final':
      return advanceNationalChampionship(state, teams, planFor, coachingFor);
    case 'complete':
      return state;
  }
}

export const TOURNAMENT_ROUND_LABELS: Record<TournamentPhase, string> = {
  conf_semis: 'Conference Semifinal',
  conf_finals: 'Conference Final',
  ncaa_first_round: 'NCAA First Round',
  ncaa_quarterfinals: 'NCAA Quarterfinal',
  national_semis: 'National Semifinal',
  national_final: 'National Championship',
  complete: 'Tournament',
};

/** Whether a team has a game in the round the tournament is on. */
export function teamPlaysThisRound(state: TournamentState, teamId: string): boolean {
  const has = (g: TournamentGame | undefined) => g !== undefined && !g.result && (g.homeTeamId === teamId || g.awayTeamId === teamId);
  switch (state.phase) {
    case 'conf_semis':
      return state.conferenceBrackets.some((b) => has(b.semifinal1) || has(b.semifinal2));
    case 'conf_finals':
      return state.conferenceBrackets.some(
        (b) => !b.final && (b.semifinal1.result?.winnerId === teamId || b.semifinal2.result?.winnerId === teamId),
      );
    case 'ncaa_first_round':
      return (state.ncaaFirstRound ?? []).some(has);
    case 'ncaa_quarterfinals':
      return (state.ncaaQuarterfinals ?? []).some(has);
    case 'national_semis':
      return has(state.nationalSemiFinal1) || has(state.nationalSemiFinal2);
    case 'national_final':
      return has(state.nationalGame);
    case 'complete':
      return false;
  }
}

/** The team's opponent in the round the tournament is on, if they play in it. */
export function opponentThisRound(state: TournamentState, teamId: string): { opponentId: string; isHome: boolean } | null {
  if (state.phase === 'conf_finals') {
    for (const b of state.conferenceBrackets) {
      if (b.final) continue;
      const w1 = b.semifinal1.result?.winnerId;
      const w2 = b.semifinal2.result?.winnerId;
      // The top semifinal's winner hosts the final.
      if (w1 === teamId && w2) return { opponentId: w2, isHome: true };
      if (w2 === teamId && w1) return { opponentId: w1, isHome: false };
    }
    return null;
  }
  const game = currentRoundGames(state).find(
    (g) => !g.result && (g.homeTeamId === teamId || g.awayTeamId === teamId),
  );
  if (!game) return null;
  return game.homeTeamId === teamId
    ? { opponentId: game.awayTeamId, isHome: true }
    : { opponentId: game.homeTeamId, isHome: false };
}

function currentRoundGames(state: TournamentState): TournamentGame[] {
  switch (state.phase) {
    case 'conf_semis':
      return state.conferenceBrackets.flatMap((b) => [b.semifinal1, b.semifinal2]);
    case 'ncaa_first_round':
      return state.ncaaFirstRound ?? [];
    case 'ncaa_quarterfinals':
      return state.ncaaQuarterfinals ?? [];
    case 'national_semis':
      return [state.nationalSemiFinal1, state.nationalSemiFinal2].filter((g): g is TournamentGame => g !== undefined);
    case 'national_final':
      return state.nationalGame ? [state.nationalGame] : [];
    default:
      return [];
  }
}

/**
 * Whether the team can still play in this postseason. Until the NCAA field is
 * picked a team outside its conference bracket can still get an at-large bid;
 * after that, only teams in the field without a loss are alive.
 */
export function stillAlive(state: TournamentState, teamId: string): boolean {
  if (state.phase === 'complete') return false;
  if (!state.ncaaField) return true;
  if (!state.ncaaField.some((e) => e.teamId === teamId)) return false;
  return !tournamentGames(state).some(
    (g) => g.result && g.result.winnerId !== teamId && (g.homeTeamId === teamId || g.awayTeamId === teamId) && isNcaaGame(state, g),
  );
}

function isNcaaGame(state: TournamentState, game: TournamentGame): boolean {
  return !state.conferenceBrackets.some((b) => b.semifinal1.id === game.id || b.semifinal2.id === game.id || b.final?.id === game.id);
}

/** Every game in the tournament so far, played or not. */
export function tournamentGames(state: TournamentState): TournamentGame[] {
  return [
    ...state.conferenceBrackets.flatMap((b) => [b.semifinal1, b.semifinal2, ...(b.final ? [b.final] : [])]),
    ...(state.ncaaFirstRound ?? []),
    ...(state.ncaaQuarterfinals ?? []),
    ...(state.nationalSemiFinal1 ? [state.nationalSemiFinal1] : []),
    ...(state.nationalSemiFinal2 ? [state.nationalSemiFinal2] : []),
    ...(state.nationalGame ? [state.nationalGame] : []),
  ];
}

/** Each team's postseason wins and losses: conference tournament plus NCAA. */
export function postseasonRecords(state: TournamentState | null | undefined): Map<string, { wins: number; losses: number }> {
  const records = new Map<string, { wins: number; losses: number }>();
  const bump = (teamId: string, key: 'wins' | 'losses') => {
    const record = records.get(teamId) ?? { wins: 0, losses: 0 };
    record[key] += 1;
    records.set(teamId, record);
  };
  for (const game of state ? tournamentGames(state) : []) {
    if (!game.result) continue;
    bump(game.result.winnerId, 'wins');
    bump(game.result.loserId, 'losses');
  }
  return records;
}

/** The game a team plays in the current round, read from the round once played. */
export function teamGameThisRound(before: TournamentState, after: TournamentState, teamId: string): TournamentGame | null {
  const playedBefore = new Set(tournamentGames(before).filter((g) => g.result).map((g) => g.id));
  return (
    tournamentGames(after).find(
      (g) => g.result && !playedBefore.has(g.id) && (g.homeTeamId === teamId || g.awayTeamId === teamId),
    ) ?? null
  );
}

export interface TournamentGameResult {
  winnerId: string;
  loserId: string;
  winnerScore: number;
  loserScore: number;
  overtime: boolean;
  teamStats?: { home: LacrosseTeamStats; away: LacrosseTeamStats };
  log?: GameLog;
}

export interface TournamentGame {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  conferenceId: string | null;
  result?: TournamentGameResult;
}

export interface ConferenceBracket {
  conferenceId: string;
  seeds: [string, string, string, string];
  semifinal1: TournamentGame;
  semifinal2: TournamentGame;
  final?: TournamentGame;
  champion?: string;
}

export type TournamentPhase =
  | 'conf_semis'
  | 'conf_finals'
  | 'ncaa_first_round'
  | 'ncaa_quarterfinals'
  | 'national_semis'
  | 'national_final'
  | 'complete';

/** NCAA field size: every conference champion plus the best at-large teams. Seeds 1-4 get byes. */
export const NCAA_FIELD_SIZE = 12;

export interface NcaaEntry {
  teamId: string;
  seed: number;
  bid: 'auto' | 'at-large';
  rpi: number;
  /** Wins over top-quarter RPI teams. Missing on older saves. */
  qualityWins?: number;
  /** Losses to bottom-half RPI teams. Missing on older saves. */
  badLosses?: number;
}

export interface NcaaBubbleEntry {
  teamId: string;
  rpi: number;
  qualityWins?: number;
  badLosses?: number;
}

export interface TournamentState {
  phase: TournamentPhase;
  conferenceBrackets: ConferenceBracket[];
  /** Seeded NCAA field, chosen on selection day after the conference finals. */
  ncaaField?: NcaaEntry[];
  /** The best teams left out, for the selection-day "first four out" list. */
  ncaaFirstOut?: NcaaBubbleEntry[];
  ncaaFirstRound?: TournamentGame[];
  ncaaQuarterfinals?: TournamentGame[];
  nationalSemiFinal1?: TournamentGame;
  nationalSemiFinal2?: TournamentGame;
  nationalGame?: TournamentGame;
  nationalChampion?: string;
}

export function initTournament(standings: StandingsEntry[], conferences: Conference[]): TournamentState {
  return {
    phase: 'conf_semis',
    conferenceBrackets: conferences.map((conf) => buildBracket(conf.id, conf.teamIds, standings)),
  };
}

export function advanceTournamentSemis(state: TournamentState, teams: LacrosseTeam[], planFor: GamePlanResolver = deriveCpuGamePlan, coachingFor: CoachingResolver = NO_COACHING): TournamentState {
  return {
    ...state,
    phase: 'conf_finals',
    conferenceBrackets: state.conferenceBrackets.map((bracket) => simulateSemifinals(bracket, teams, planFor, coachingFor)),
  };
}

export function advanceTournamentFinals(
  state: TournamentState,
  teams: LacrosseTeam[],
  planFor: GamePlanResolver = deriveCpuGamePlan,
  schedule: ScheduledGame[] = [],
  coachingFor: CoachingResolver = NO_COACHING,
): TournamentState {
  const updatedBrackets = state.conferenceBrackets.map((bracket) => simulateFinal(bracket, teams, planFor, coachingFor));
  const champions = updatedBrackets.map((b) => b.champion!).filter(Boolean);
  const { field, firstOut } = selectNcaaField(champions, teams, schedule);
  const selected = { conferenceBrackets: updatedBrackets, ncaaField: field, ncaaFirstOut: firstOut };

  // Small leagues (custom team files) can't fill a bracket with byes: go
  // straight to a seeded final four, or to a title game.
  if (field.length < NCAA_FIELD_SIZE) {
    const ids = field.map((e) => e.teamId);
    if (ids.length < 4) {
      return {
        ...state,
        ...selected,
        phase: 'national_final',
        nationalGame: ncaaGame('national-championship', ids[0]!, ids[1] ?? ids[0]!),
      };
    }
    return {
      ...state,
      ...selected,
      phase: 'national_semis',
      nationalSemiFinal1: ncaaGame('national-semi-1', ids[0]!, ids[3]!),
      nationalSemiFinal2: ncaaGame('national-semi-2', ids[1]!, ids[2]!),
    };
  }

  const bySeed = (seed: number) => field[seed - 1]!.teamId;
  // Seeds 5-12 play in; the higher seed hosts. Order matches QUARTERFINAL_HOSTS.
  const ncaaFirstRound = [
    ncaaGame('ncaa-r1-8v9', bySeed(8), bySeed(9)),
    ncaaGame('ncaa-r1-5v12', bySeed(5), bySeed(12)),
    ncaaGame('ncaa-r1-6v11', bySeed(6), bySeed(11)),
    ncaaGame('ncaa-r1-7v10', bySeed(7), bySeed(10)),
  ];
  return { ...state, ...selected, phase: 'ncaa_first_round', ncaaFirstRound };
}

/** Quarterfinal hosts, in first-round order: 1 meets the 8/9 winner, 4 the 5/12 winner, and so on. */
const QUARTERFINAL_HOSTS = [1, 4, 3, 2];

export function advanceNcaaFirstRound(
  state: TournamentState,
  teams: LacrosseTeam[],
  planFor: GamePlanResolver = deriveCpuGamePlan,
  coachingFor: CoachingResolver = NO_COACHING,
): TournamentState {
  if (!state.ncaaFirstRound || !state.ncaaField) return state;
  const field = state.ncaaField;
  const played = state.ncaaFirstRound.map((g) => ({ ...g, result: playTournamentGame(g, teams, planFor, false, coachingFor) }));
  const ncaaQuarterfinals = QUARTERFINAL_HOSTS.map((seed, i) =>
    ncaaGame(`ncaa-qf-${seed}`, field[seed - 1]!.teamId, played[i]!.result.winnerId),
  );
  return { ...state, phase: 'ncaa_quarterfinals', ncaaFirstRound: played, ncaaQuarterfinals };
}

export function advanceNcaaQuarterfinals(
  state: TournamentState,
  teams: LacrosseTeam[],
  planFor: GamePlanResolver = deriveCpuGamePlan,
  coachingFor: CoachingResolver = NO_COACHING,
): TournamentState {
  if (!state.ncaaQuarterfinals) return state;
  const played = state.ncaaQuarterfinals.map((g) => ({ ...g, result: playTournamentGame(g, teams, planFor, false, coachingFor) }));
  const seedOf = ncaaSeedLookup(state);
  // Final Four: the 1 quadrant meets the 4 quadrant, 3 meets 2. The better seed hosts.
  const pair = (id: string, a: string, b: string) => (seedOf(a) <= seedOf(b) ? ncaaGame(id, a, b) : ncaaGame(id, b, a));
  const w = played.map((g) => g.result.winnerId);
  return {
    ...state,
    phase: 'national_semis',
    ncaaQuarterfinals: played,
    nationalSemiFinal1: pair('national-semi-1', w[0]!, w[1]!),
    nationalSemiFinal2: pair('national-semi-2', w[2]!, w[3]!),
  };
}

export function ncaaSeedLookup(state: TournamentState): (teamId: string) => number {
  const seeds = new Map((state.ncaaField ?? []).map((e) => [e.teamId, e.seed]));
  return (teamId) => seeds.get(teamId) ?? 99;
}

const EMPTY_RECORD: StandingsEntry['record'] = {
  wins: 0,
  losses: 0,
  conferenceWins: 0,
  conferenceLosses: 0,
  homeWins: 0,
  homeLosses: 0,
  awayWins: 0,
  awayLosses: 0,
  neutralWins: 0,
  neutralLosses: 0,
};

function ncaaGame(id: string, homeTeamId: string, awayTeamId: string): TournamentGame {
  return { id, homeTeamId, awayTeamId, conferenceId: null };
}

/**
 * RPI-style selection metric from the regular-season schedule: 25% own
 * winning percentage, 50% opponents', 25% opponents' opponents'. Strength of
 * schedule counts for more than raw record, as it does on selection Sunday.
 */
export function computeRpi(teams: LacrosseTeam[], schedule: ScheduledGame[]): Map<string, number> {
  const opponents = new Map<string, string[]>();
  for (const g of schedule) {
    if (g.status !== 'final' || !g.result) continue;
    opponents.set(g.homeTeamId, [...(opponents.get(g.homeTeamId) ?? []), g.awayTeamId]);
    opponents.set(g.awayTeamId, [...(opponents.get(g.awayTeamId) ?? []), g.homeTeamId]);
  }
  const wp = new Map(teams.map((t) => [t.id, winPct(t)]));
  const avg = (ids: string[], f: (id: string) => number) =>
    ids.length > 0 ? ids.reduce((sum, id) => sum + f(id), 0) / ids.length : 0;
  const owp = new Map(teams.map((t) => [t.id, avg(opponents.get(t.id) ?? [], (o) => wp.get(o) ?? 0)]));
  const oowp = new Map(teams.map((t) => [t.id, avg(opponents.get(t.id) ?? [], (o) => owp.get(o) ?? 0)]));
  return new Map(
    teams.map((t) => [t.id, 0.25 * (wp.get(t.id) ?? 0) + 0.5 * (owp.get(t.id) ?? 0) + 0.25 * (oowp.get(t.id) ?? 0)]),
  );
}

function winPct(team: LacrosseTeam): number {
  const games = team.record.wins + team.record.losses;
  return games > 0 ? team.record.wins / games : 0;
}

/** What the selection committee weighs beyond RPI. */
export interface SelectionResume {
  rpi: number;
  /** Wins over teams in the top quarter of the RPI. */
  qualityWins: number;
  /** Losses to teams in the bottom half of the RPI. */
  badLosses: number;
  /** RPI plus a bump per quality win, minus one per bad loss. Orders the field. */
  score: number;
}

/** Each quality win or bad loss moves a resume this much, about a few RPI spots. */
export const RESUME_GAME_WEIGHT = 0.01;

/**
 * The committee's resume for every team: RPI, quality wins and bad losses
 * from the regular season, rolled into one selection score.
 */
export function selectionResumes(teams: LacrosseTeam[], schedule: ScheduledGame[]): Map<string, SelectionResume> {
  const rpi = computeRpi(teams, schedule);
  const order = [...rpi.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const rank = new Map(order.map((id, i) => [id, i + 1]));
  const qualityCut = Math.ceil(order.length / 4);
  const badCut = order.length / 2;
  const qualityWins = new Map<string, number>();
  const badLosses = new Map<string, number>();
  const bump = (m: Map<string, number>, id: string) => m.set(id, (m.get(id) ?? 0) + 1);
  for (const g of schedule) {
    if (g.status !== 'final' || !g.result) continue;
    const winner = g.result.winnerTeamId;
    const loser = winner === g.homeTeamId ? g.awayTeamId : g.homeTeamId;
    if ((rank.get(loser) ?? Infinity) <= qualityCut) bump(qualityWins, winner);
    if ((rank.get(winner) ?? 0) > badCut) bump(badLosses, loser);
  }
  return new Map(
    teams.map((t) => {
      const r = rpi.get(t.id) ?? 0;
      const qw = qualityWins.get(t.id) ?? 0;
      const bl = badLosses.get(t.id) ?? 0;
      return [t.id, { rpi: r, qualityWins: qw, badLosses: bl, score: r + RESUME_GAME_WEIGHT * (qw - bl) }];
    }),
  );
}

/** NCAA rule: a team needs a .500 record or better to earn an at-large bid. */
export function atLargeEligible(team: Pick<LacrosseTeam, 'record'>): boolean {
  return team.record.wins >= team.record.losses;
}

/**
 * Selection day: conference champions get automatic bids, the best remaining
 * resumes among .500-or-better teams fill the at-large spots (losing teams
 * only if there aren't enough), and the whole field is seeded by resume:
 * RPI, plus quality wins, minus bad losses.
 */
export function selectNcaaField(
  champions: string[],
  teams: LacrosseTeam[],
  schedule: ScheduledGame[],
): { field: NcaaEntry[]; firstOut: NcaaBubbleEntry[] } {
  const resumes = selectionResumes(teams, schedule);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const pct = (id: string) => {
    const t = teamById.get(id);
    return t ? winPct(t) : 0;
  };
  const score = (id: string) => resumes.get(id)?.score ?? 0;
  const byResume = (a: string, b: string) => score(b) - score(a) || pct(b) - pct(a);
  const resumeOf = (teamId: string) => {
    const r = resumes.get(teamId);
    return { rpi: r?.rpi ?? 0, qualityWins: r?.qualityWins ?? 0, badLosses: r?.badLosses ?? 0 };
  };

  const auto = [...new Set(champions)];
  const autoSet = new Set(auto);
  const others = teams.filter((t) => !autoSet.has(t.id));
  // Losing teams only come in if the bracket can't be filled without them.
  const pool = [
    ...others.filter(atLargeEligible).map((t) => t.id).sort(byResume),
    ...others.filter((t) => !atLargeEligible(t)).map((t) => t.id).sort(byResume),
  ];
  const atLargeCount = Math.max(0, ncaaFieldSize(teams.length) - auto.length);
  const firstOut = pool.slice(atLargeCount, atLargeCount + 4).map((teamId) => ({ teamId, ...resumeOf(teamId) }));

  const field = [...auto, ...pool.slice(0, atLargeCount)].sort(byResume).map((teamId, i) => ({
    teamId,
    seed: i + 1,
    bid: autoSet.has(teamId) ? ('auto' as const) : ('at-large' as const),
    ...resumeOf(teamId),
  }));
  return { field, firstOut };
}

/**
 * How many teams the bracket can actually play: the full 12-team field, a
 * seeded final four for small leagues, or a title game for the tiniest.
 */
export function ncaaFieldSize(teamCount: number): number {
  if (teamCount >= NCAA_FIELD_SIZE) return NCAA_FIELD_SIZE;
  if (teamCount >= 4) return 4;
  return Math.max(2, teamCount);
}

export function advanceTournamentNationalSemis(state: TournamentState, teams: LacrosseTeam[], planFor: GamePlanResolver = deriveCpuGamePlan, coachingFor: CoachingResolver = NO_COACHING): TournamentState {
  if (!state.nationalSemiFinal1 || !state.nationalSemiFinal2) return state;
  const result1 = playTournamentGame(state.nationalSemiFinal1, teams, planFor, true, coachingFor);
  const result2 = playTournamentGame(state.nationalSemiFinal2, teams, planFor, true, coachingFor);
  const nationalGame: TournamentGame = {
    id: 'national-championship',
    homeTeamId: result1.winnerId,
    awayTeamId: result2.winnerId,
    conferenceId: null,
  };
  return {
    ...state,
    phase: 'national_final',
    nationalSemiFinal1: { ...state.nationalSemiFinal1, result: result1 },
    nationalSemiFinal2: { ...state.nationalSemiFinal2, result: result2 },
    nationalGame,
  };
}

export function advanceNationalChampionship(state: TournamentState, teams: LacrosseTeam[], planFor: GamePlanResolver = deriveCpuGamePlan, coachingFor: CoachingResolver = NO_COACHING): TournamentState {
  if (!state.nationalGame) return state;
  const result = playTournamentGame(state.nationalGame, teams, planFor, true, coachingFor);
  return {
    ...state,
    phase: 'complete',
    nationalGame: { ...state.nationalGame, result },
    nationalChampion: result.winnerId,
  };
}

/** Conference standings order: league record first, overall record as the tiebreak. */
export function compareConferenceStanding(
  a: Pick<StandingsEntry, 'record'>,
  b: Pick<StandingsEntry, 'record'>,
): number {
  return (
    b.record.conferenceWins - a.record.conferenceWins ||
    a.record.conferenceLosses - b.record.conferenceLosses ||
    b.record.wins - a.record.wins ||
    a.record.losses - b.record.losses
  );
}

function buildBracket(confId: string, teamIds: string[], standings: StandingsEntry[]): ConferenceBracket {
  // Conference tournaments seed by league record; overall record breaks ties.
  const seeded = teamIds
    .map((id) => standings.find((e) => e.teamId === id) ?? { teamId: id, record: EMPTY_RECORD })
    .sort(compareConferenceStanding)
    .map((e) => ({ id: e.teamId }));

  const s1 = seeded[0]?.id ?? teamIds[0]!;
  const s2 = seeded[1]?.id ?? teamIds[1]!;
  const s3 = seeded[2]?.id ?? teamIds[2]!;
  const s4 = seeded[3]?.id ?? teamIds[3]!;

  return {
    conferenceId: confId,
    seeds: [s1, s2, s3, s4],
    semifinal1: { id: `${confId}-sf1`, homeTeamId: s1, awayTeamId: s4, conferenceId: confId },
    semifinal2: { id: `${confId}-sf2`, homeTeamId: s2, awayTeamId: s3, conferenceId: confId },
  };
}

function simulateSemifinals(bracket: ConferenceBracket, teams: LacrosseTeam[], planFor: GamePlanResolver, coachingFor: CoachingResolver): ConferenceBracket {
  return {
    ...bracket,
    semifinal1: { ...bracket.semifinal1, result: playTournamentGame(bracket.semifinal1, teams, planFor, false, coachingFor) },
    semifinal2: { ...bracket.semifinal2, result: playTournamentGame(bracket.semifinal2, teams, planFor, false, coachingFor) },
  };
}

function simulateFinal(bracket: ConferenceBracket, teams: LacrosseTeam[], planFor: GamePlanResolver, coachingFor: CoachingResolver): ConferenceBracket {
  const sf1Winner = bracket.semifinal1.result!.winnerId;
  const sf2Winner = bracket.semifinal2.result!.winnerId;
  const final: TournamentGame = {
    id: `${bracket.conferenceId}-final`,
    homeTeamId: sf1Winner,
    awayTeamId: sf2Winner,
    conferenceId: bracket.conferenceId,
  };
  const result = playTournamentGame(final, teams, planFor, false, coachingFor);
  return { ...bracket, final: { ...final, result }, champion: result.winnerId };
}

function playTournamentGame(
  game: TournamentGame,
  teams: LacrosseTeam[],
  planFor: GamePlanResolver,
  neutralSite = false,
  coachingFor: CoachingResolver = NO_COACHING,
): TournamentGameResult {
  const homeTeam = teams.find((t) => t.id === game.homeTeamId)!;
  const awayTeam = teams.find((t) => t.id === game.awayTeamId)!;
  const coached = activeCoaching && (homeTeam.id === activeCoaching.teamId || awayTeam.id === activeCoaching.teamId) ? activeCoaching : null;
  const secondHalf = coached?.secondHalfPlan
    ? homeTeam.id === coached.teamId
      ? { homeSecondHalfPlan: coached.secondHalfPlan }
      : { awaySecondHalfPlan: coached.secondHalfPlan }
    : {};
  const result = simulateLacrosseGameWithLog({
    homeTeam,
    awayTeam,
    homeGamePlan: planFor(homeTeam),
    awayGamePlan: planFor(awayTeam),
    neutralSite,
    homeCoaching: coachingFor(homeTeam),
    awayCoaching: coachingFor(awayTeam),
    ...(coached ? { random: seededGameRandom(coached.seed) } : {}),
    ...secondHalf,
  });
  const homeWon = result.winnerTeamId === homeTeam.id;

  return {
    winnerId: result.winnerTeamId,
    loserId: result.loserTeamId,
    winnerScore: homeWon ? result.homeScore : result.awayScore,
    loserScore: homeWon ? result.awayScore : result.homeScore,
    overtime: result.overtime,
    ...(result.teamStats ? { teamStats: result.teamStats } : {}),
    log: result.log,
  };
}

export interface NcaaProjection {
  field: NcaaEntry[];
  firstOut: NcaaBubbleEntry[];
  /** Projected auto bid per conference: its current league leader. */
  leaders: Map<string, string>;
  /** Every team's RPI rank, 1 = best. */
  rpiRank: Map<string, number>;
}

/**
 * Bracketology: who would make the NCAA field if the season ended today.
 * Each conference's current leader takes the auto bid (the real one goes to
 * the conference tournament winner) and selection runs exactly as it does on
 * selection day.
 */
export function projectNcaaField(
  teams: LacrosseTeam[],
  conferences: Conference[],
  standings: StandingsEntry[],
  schedule: ScheduledGame[],
): NcaaProjection {
  const leaders = new Map<string, string>();
  for (const conf of conferences) {
    const leader = conf.teamIds
      .map((id) => standings.find((e) => e.teamId === id) ?? { teamId: id, record: EMPTY_RECORD })
      .sort(compareConferenceStanding)[0];
    if (leader) leaders.set(conf.id, leader.teamId);
  }
  const { field, firstOut } = selectNcaaField([...leaders.values()], teams, schedule);
  const rpi = computeRpi(teams, schedule);
  const rpiRank = new Map(
    [...rpi.entries()].sort((a, b) => b[1] - a[1]).map(([teamId], i) => [teamId, i + 1] as const),
  );
  return { field, firstOut, leaders, rpiRank };
}

/** One line on where a team stands, e.g. "Projected #4 seed (auto bid)". */
export function projectionStatus(projection: NcaaProjection, teamId: string): string {
  const entry = projection.field.find((e) => e.teamId === teamId);
  if (entry) return `Projected #${entry.seed} seed (${entry.bid === 'auto' ? 'auto bid' : 'at-large'})`;
  const bubble = projection.firstOut.findIndex((e) => e.teamId === teamId);
  if (bubble >= 0) return `First four out (#${bubble + 1})`;
  return `Out of the field (RPI #${projection.rpiRank.get(teamId) ?? '?'})`;
}

/** Seed swings smaller than this aren't news. */
const BRACKET_NEWS_SEED_SWING = 3;

/**
 * Bubble watch: a headline when a week moves a team into or out of the
 * projected field, or swings its projected seed by three or more.
 */
export function bracketMovementHeadline(
  before: NcaaProjection,
  after: NcaaProjection,
  teamId: string,
  teamName: string,
): string | null {
  const was = before.field.find((e) => e.teamId === teamId);
  const now = after.field.find((e) => e.teamId === teamId);
  if (!was && now) return `Bubble watch: ${teamName} plays its way into the projected NCAA field as the #${now.seed} seed`;
  if (was && !now) {
    const bubble = after.firstOut.some((e) => e.teamId === teamId);
    return `Bubble watch: ${teamName} falls out of the projected NCAA field${bubble ? ' and into the first four out' : ''}`;
  }
  if (was && now && Math.abs(was.seed - now.seed) >= BRACKET_NEWS_SEED_SWING) {
    return now.seed < was.seed
      ? `Bracketology: ${teamName} climbs from a projected #${was.seed} to a #${now.seed} seed`
      : `Bracketology: ${teamName} slides from a projected #${was.seed} to a #${now.seed} seed`;
  }
  return null;
}
