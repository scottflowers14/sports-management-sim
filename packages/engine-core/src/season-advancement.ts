import type { GameResult, ScheduledGame, Season, Team } from './models';

export type SimulateScheduledGame<Position extends string = string, SportTraits = unknown> = (
  game: ScheduledGame,
  homeTeam: Team<Position, SportTraits>,
  awayTeam: Team<Position, SportTraits>,
) => GameResult;

export function advanceSeasonWeek<Position extends string = string, SportTraits = unknown>(
  season: Season<Position, SportTraits>,
  simulateGame: SimulateScheduledGame<Position, SportTraits>,
): Season<Position, SportTraits> {
  const teamsById = new Map(season.teams.map((team) => [team.id, cloneTeam(team)]));

  const schedule = season.schedule.map((game) => {
    if (game.week !== season.currentWeek || game.status !== 'scheduled') {
      return { ...game };
    }

    const homeTeam = teamsById.get(game.homeTeamId);
    const awayTeam = teamsById.get(game.awayTeamId);

    if (homeTeam === undefined || awayTeam === undefined) {
      return { ...game };
    }

    const result = simulateGame(game, homeTeam, awayTeam);
    applyGameResult(homeTeam, awayTeam, game, result);

    return {
      ...game,
      status: 'final' as const,
      result,
    };
  });

  const teams = season.teams.map((team) => teamsById.get(team.id) ?? cloneTeam(team));

  return {
    ...season,
    teams,
    schedule,
    standings: buildStandings(teams),
    currentWeek: season.currentWeek + 1,
  };
}

function cloneTeam<Position extends string, SportTraits>(team: Team<Position, SportTraits>): Team<Position, SportTraits> {
  return {
    ...team,
    resources: { ...team.resources },
    reputation: { ...team.reputation },
    record: { ...team.record },
    roster: [...team.roster],
  };
}

function applyGameResult<Position extends string, SportTraits>(
  homeTeam: Team<Position, SportTraits>,
  awayTeam: Team<Position, SportTraits>,
  game: ScheduledGame,
  result: GameResult,
): void {
  const homeWon = result.winnerTeamId === homeTeam.id;
  const winner = homeWon ? homeTeam : awayTeam;
  const loser = homeWon ? awayTeam : homeTeam;

  winner.record.wins += 1;
  loser.record.losses += 1;

  if (game.conferenceGame) {
    winner.record.conferenceWins += 1;
    loser.record.conferenceLosses += 1;
  }

  if (game.neutralSite === true) {
    winner.record.neutralWins += 1;
    loser.record.neutralLosses += 1;
    return;
  }

  if (homeWon) {
    homeTeam.record.homeWins += 1;
    awayTeam.record.awayLosses += 1;
  } else {
    awayTeam.record.awayWins += 1;
    homeTeam.record.homeLosses += 1;
  }
}

function buildStandings<Position extends string, SportTraits>(teams: Team<Position, SportTraits>[]) {
  return teams.map((team, index) => ({
    teamId: team.id,
    conferenceId: team.conferenceId,
    record: { ...team.record },
    pointsFor: 0,
    pointsAgainst: 0,
    strengthOfSchedule: 0,
    rankingScore: team.record.wins * 100 - team.record.losses * 25,
    nationalRank: index + 1,
    conferenceRank: index + 1,
  }));
}
