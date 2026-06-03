import type { ScheduledGame } from '@sports-management-sim/engine-core';
import { calculateLacrosseTeamRating } from '@sports-management-sim/sport-lacrosse';
import type { LacrosseTeam, LacrosseTeamRating } from '@sports-management-sim/sport-lacrosse';

export interface ScheduleMatchupPreview {
  game: ScheduledGame;
  userTeam: LacrosseTeam;
  opponent: LacrosseTeam;
  userIsHome: boolean;
  userRating: LacrosseTeamRating;
  opponentRating: LacrosseTeamRating;
  ratingEdge: number;
  offenseEdge: number;
  defenseEdge: number;
  goalieEdge: number;
  faceoffEdge: number;
  favoriteTeamId: string;
  matchupNote: string;
}

export function getNextUserGamePreview({
  schedule,
  teams,
  userTeamId,
  currentWeek,
}: {
  schedule: ScheduledGame[];
  teams: LacrosseTeam[];
  userTeamId: string;
  currentWeek: number;
}): ScheduleMatchupPreview | null {
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const nextGame = [...schedule]
    .filter(
      (game) =>
        !game.result &&
        game.week >= currentWeek &&
        (game.homeTeamId === userTeamId || game.awayTeamId === userTeamId),
    )
    .sort((a, b) => a.week - b.week || a.id.localeCompare(b.id))[0];

  if (!nextGame) {
    return null;
  }

  const userTeam = teamById.get(userTeamId);
  const opponentId = nextGame.homeTeamId === userTeamId ? nextGame.awayTeamId : nextGame.homeTeamId;
  const opponent = teamById.get(opponentId);

  if (!userTeam || !opponent) {
    return null;
  }

  return buildScheduleMatchupPreview(nextGame, userTeam, opponent, nextGame.homeTeamId === userTeamId);
}

export function buildScheduleMatchupPreview(
  game: ScheduledGame,
  userTeam: LacrosseTeam,
  opponent: LacrosseTeam,
  userIsHome: boolean,
): ScheduleMatchupPreview {
  const userRating = calculateLacrosseTeamRating(userTeam);
  const opponentRating = calculateLacrosseTeamRating(opponent);
  const ratingEdge = userRating.overall - opponentRating.overall;
  const favoriteTeamId = ratingEdge >= 0 ? userTeam.id : opponent.id;

  return {
    game,
    userTeam,
    opponent,
    userIsHome,
    userRating,
    opponentRating,
    ratingEdge,
    offenseEdge: userRating.offense - opponentRating.defense,
    defenseEdge: userRating.defense - opponentRating.offense,
    goalieEdge: userRating.goalie - opponentRating.goalie,
    faceoffEdge: userRating.faceoff - opponentRating.faceoff,
    favoriteTeamId,
    matchupNote: describeMatchupEdge(Math.abs(ratingEdge), userTeam.id === favoriteTeamId),
  };
}

function describeMatchupEdge(edge: number, userFavored: boolean): string {
  if (edge >= 12) {
    return userFavored ? 'You should control this matchup.' : 'Upset bid: opponent has a clear ratings edge.';
  }

  if (edge >= 6) {
    return userFavored ? 'You have a modest ratings edge.' : 'Opponent has a modest ratings edge.';
  }

  return 'Toss-up on paper.';
}
