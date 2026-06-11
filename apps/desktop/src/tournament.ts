import { deriveCpuGamePlan, simulateLacrosseGameWithLog } from '@sports-management-sim/sport-lacrosse';
import type { GameLog, LacrosseGamePlan, LacrosseTeam, LacrosseTeamStats } from '@sports-management-sim/sport-lacrosse';
import type { Conference, StandingsEntry } from '@sports-management-sim/engine-core';

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

export type TournamentPhase = 'conf_semis' | 'conf_finals' | 'national_semis' | 'national_final' | 'complete';

export interface TournamentState {
  phase: TournamentPhase;
  conferenceBrackets: ConferenceBracket[];
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

export function advanceTournamentFinals(state: TournamentState, teams: LacrosseTeam[], planFor: GamePlanResolver = deriveCpuGamePlan): TournamentState {
  const updatedBrackets = state.conferenceBrackets.map((bracket) => simulateFinal(bracket, teams, planFor));
  const champions = updatedBrackets.map((b) => b.champion!);

  // With exactly 2 conferences skip national semis — go straight to the championship game.
  if (champions.length === 2) {
    const nationalGame: TournamentGame = {
      id: 'national-championship',
      homeTeamId: champions[0]!,
      awayTeamId: champions[1]!,
      conferenceId: null,
    };
    return { ...state, phase: 'national_final', conferenceBrackets: updatedBrackets, nationalGame };
  }

  // 4+ conferences: seed1 vs seed4, seed2 vs seed3 (by bracket index).
  const nationalSemiFinal1: TournamentGame = {
    id: 'national-semi-1',
    homeTeamId: champions[0]!,
    awayTeamId: champions[champions.length - 1]!,
    conferenceId: null,
  };
  const nationalSemiFinal2: TournamentGame = {
    id: 'national-semi-2',
    homeTeamId: champions[1]!,
    awayTeamId: champions[champions.length - 2]!,
    conferenceId: null,
  };
  return { ...state, phase: 'national_semis', conferenceBrackets: updatedBrackets, nationalSemiFinal1, nationalSemiFinal2 };
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
