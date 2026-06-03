import { simulateLacrosseGameWithLog } from '@sports-management-sim/sport-lacrosse';
import type { GameLog, LacrosseTeam, LacrosseTeamStats } from '@sports-management-sim/sport-lacrosse';
import type { StandingsEntry } from '@sports-management-sim/engine-core';

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

export type TournamentPhase = 'semis' | 'finals' | 'national' | 'complete';

export interface TournamentState {
  phase: TournamentPhase;
  accBracket: ConferenceBracket;
  necBracket: ConferenceBracket;
  nationalGame?: TournamentGame;
  nationalChampion?: string;
}

const ACC_IDS = ['maryland-state', 'virginia-lakes', 'long-island-tech', 'georgetown-prep'];
const NEC_IDS = ['new-england-college', 'colorado-front-range', 'syracuse-heights', 'penn-state-valley'];

export function initTournament(standings: StandingsEntry[]): TournamentState {
  return {
    phase: 'semis',
    accBracket: buildBracket('acc', ACC_IDS, standings),
    necBracket: buildBracket('nec', NEC_IDS, standings),
  };
}

export function advanceTournamentSemis(state: TournamentState, teams: LacrosseTeam[]): TournamentState {
  return {
    ...state,
    phase: 'finals',
    accBracket: simulateSemifinals(state.accBracket, teams),
    necBracket: simulateSemifinals(state.necBracket, teams),
  };
}

export function advanceTournamentFinals(state: TournamentState, teams: LacrosseTeam[]): TournamentState {
  const accBracket = simulateFinal(state.accBracket, teams);
  const necBracket = simulateFinal(state.necBracket, teams);
  const nationalGame: TournamentGame = {
    id: 'national-championship',
    homeTeamId: accBracket.champion!,
    awayTeamId: necBracket.champion!,
    conferenceId: null,
  };
  return { ...state, phase: 'national', accBracket, necBracket, nationalGame };
}

export function advanceNationalChampionship(state: TournamentState, teams: LacrosseTeam[]): TournamentState {
  if (!state.nationalGame) return state;
  const result = playTournamentGame(state.nationalGame, teams);
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

function simulateSemifinals(bracket: ConferenceBracket, teams: LacrosseTeam[]): ConferenceBracket {
  return {
    ...bracket,
    semifinal1: { ...bracket.semifinal1, result: playTournamentGame(bracket.semifinal1, teams) },
    semifinal2: { ...bracket.semifinal2, result: playTournamentGame(bracket.semifinal2, teams) },
  };
}

function simulateFinal(bracket: ConferenceBracket, teams: LacrosseTeam[]): ConferenceBracket {
  const sf1Winner = bracket.semifinal1.result!.winnerId;
  const sf2Winner = bracket.semifinal2.result!.winnerId;
  const final: TournamentGame = {
    id: `${bracket.conferenceId}-final`,
    homeTeamId: sf1Winner,
    awayTeamId: sf2Winner,
    conferenceId: bracket.conferenceId,
  };
  const result = playTournamentGame(final, teams);
  return { ...bracket, final: { ...final, result }, champion: result.winnerId };
}

function playTournamentGame(game: TournamentGame, teams: LacrosseTeam[]): TournamentGameResult {
  const homeTeam = teams.find((t) => t.id === game.homeTeamId)!;
  const awayTeam = teams.find((t) => t.id === game.awayTeamId)!;
  const result = simulateLacrosseGameWithLog({ homeTeam, awayTeam });
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
