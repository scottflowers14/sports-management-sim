import { deriveCpuGamePlan, simulateLacrosseGameWithLog } from '@sports-management-sim/sport-lacrosse';
import type { GameLog, LacrosseGamePlan, LacrosseTeam, LacrosseTeamStats } from '@sports-management-sim/sport-lacrosse';
import type { Conference, ScheduledGame, StandingsEntry } from '@sports-management-sim/engine-core';

/** Resolves the game plan a team uses in tournament play (defaults to CPU-derived plans). */
export type GamePlanResolver = (team: LacrosseTeam) => LacrosseGamePlan;

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
}

export interface NcaaBubbleEntry {
  teamId: string;
  rpi: number;
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

export function advanceTournamentSemis(state: TournamentState, teams: LacrosseTeam[], planFor: GamePlanResolver = deriveCpuGamePlan): TournamentState {
  return {
    ...state,
    phase: 'conf_finals',
    conferenceBrackets: state.conferenceBrackets.map((bracket) => simulateSemifinals(bracket, teams, planFor)),
  };
}

export function advanceTournamentFinals(
  state: TournamentState,
  teams: LacrosseTeam[],
  planFor: GamePlanResolver = deriveCpuGamePlan,
  schedule: ScheduledGame[] = [],
): TournamentState {
  const updatedBrackets = state.conferenceBrackets.map((bracket) => simulateFinal(bracket, teams, planFor));
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
): TournamentState {
  if (!state.ncaaFirstRound || !state.ncaaField) return state;
  const field = state.ncaaField;
  const played = state.ncaaFirstRound.map((g) => ({ ...g, result: playTournamentGame(g, teams, planFor) }));
  const ncaaQuarterfinals = QUARTERFINAL_HOSTS.map((seed, i) =>
    ncaaGame(`ncaa-qf-${seed}`, field[seed - 1]!.teamId, played[i]!.result.winnerId),
  );
  return { ...state, phase: 'ncaa_quarterfinals', ncaaFirstRound: played, ncaaQuarterfinals };
}

export function advanceNcaaQuarterfinals(
  state: TournamentState,
  teams: LacrosseTeam[],
  planFor: GamePlanResolver = deriveCpuGamePlan,
): TournamentState {
  if (!state.ncaaQuarterfinals) return state;
  const played = state.ncaaQuarterfinals.map((g) => ({ ...g, result: playTournamentGame(g, teams, planFor) }));
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

/**
 * Selection day: conference champions get automatic bids, the best remaining
 * RPIs fill the at-large spots, and the whole field is seeded by RPI.
 */
export function selectNcaaField(
  champions: string[],
  teams: LacrosseTeam[],
  schedule: ScheduledGame[],
): { field: NcaaEntry[]; firstOut: NcaaBubbleEntry[] } {
  const rpi = computeRpi(teams, schedule);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const pct = (id: string) => {
    const t = teamById.get(id);
    return t ? winPct(t) : 0;
  };
  const byRpi = (a: string, b: string) => (rpi.get(b) ?? 0) - (rpi.get(a) ?? 0) || pct(b) - pct(a);

  const auto = [...new Set(champions)];
  const autoSet = new Set(auto);
  const pool = teams.map((t) => t.id).filter((id) => !autoSet.has(id)).sort(byRpi);
  const atLargeCount = Math.max(0, Math.min(NCAA_FIELD_SIZE, teams.length) - auto.length);
  const firstOut = pool
    .slice(atLargeCount, atLargeCount + 4)
    .map((teamId) => ({ teamId, rpi: rpi.get(teamId) ?? 0 }));

  const field = [...auto, ...pool.slice(0, atLargeCount)].sort(byRpi).map((teamId, i) => ({
    teamId,
    seed: i + 1,
    bid: autoSet.has(teamId) ? ('auto' as const) : ('at-large' as const),
    rpi: rpi.get(teamId) ?? 0,
  }));
  return { field, firstOut };
}

export function advanceTournamentNationalSemis(state: TournamentState, teams: LacrosseTeam[], planFor: GamePlanResolver = deriveCpuGamePlan): TournamentState {
  if (!state.nationalSemiFinal1 || !state.nationalSemiFinal2) return state;
  const result1 = playTournamentGame(state.nationalSemiFinal1, teams, planFor);
  const result2 = playTournamentGame(state.nationalSemiFinal2, teams, planFor);
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

export function advanceNationalChampionship(state: TournamentState, teams: LacrosseTeam[], planFor: GamePlanResolver = deriveCpuGamePlan): TournamentState {
  if (!state.nationalGame) return state;
  const result = playTournamentGame(state.nationalGame, teams, planFor);
  return {
    ...state,
    phase: 'complete',
    nationalGame: { ...state.nationalGame, result },
    nationalChampion: result.winnerId,
  };
}

function buildBracket(confId: string, teamIds: string[], standings: StandingsEntry[]): ConferenceBracket {
  const seeded = teamIds
    .map((id) => {
      const s = standings.find((e) => e.teamId === id);
      return { id, wins: s?.record.wins ?? 0, losses: s?.record.losses ?? 0 };
    })
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses);

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

function simulateSemifinals(bracket: ConferenceBracket, teams: LacrosseTeam[], planFor: GamePlanResolver): ConferenceBracket {
  return {
    ...bracket,
    semifinal1: { ...bracket.semifinal1, result: playTournamentGame(bracket.semifinal1, teams, planFor) },
    semifinal2: { ...bracket.semifinal2, result: playTournamentGame(bracket.semifinal2, teams, planFor) },
  };
}

function simulateFinal(bracket: ConferenceBracket, teams: LacrosseTeam[], planFor: GamePlanResolver): ConferenceBracket {
  const sf1Winner = bracket.semifinal1.result!.winnerId;
  const sf2Winner = bracket.semifinal2.result!.winnerId;
  const final: TournamentGame = {
    id: `${bracket.conferenceId}-final`,
    homeTeamId: sf1Winner,
    awayTeamId: sf2Winner,
    conferenceId: bracket.conferenceId,
  };
  const result = playTournamentGame(final, teams, planFor);
  return { ...bracket, final: { ...final, result }, champion: result.winnerId };
}

function playTournamentGame(game: TournamentGame, teams: LacrosseTeam[], planFor: GamePlanResolver): TournamentGameResult {
  const homeTeam = teams.find((t) => t.id === game.homeTeamId)!;
  const awayTeam = teams.find((t) => t.id === game.awayTeamId)!;
  const result = simulateLacrosseGameWithLog({
    homeTeam,
    awayTeam,
    homeGamePlan: planFor(homeTeam),
    awayGamePlan: planFor(awayTeam),
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
