import type { ScheduledGame } from '@sports-management-sim/engine-core';
import { lacrosseWinProbability, type LacrosseTeam } from '@sports-management-sim/sport-lacrosse';
import { getNextUserGamePreview, type ScheduleMatchupPreview } from './schedule-preview';
import type { RankingEntry } from './rankings';
import type { SeasonStatsMap } from './stats';
import type { SeriesRecord } from './series-history';

export interface HubKeyPlayer {
  playerId: string;
  name: string;
  position: string;
  /** Production or rating line, e.g. "28G 14A" or "84 OVR". */
  line: string;
  isUser: boolean;
}

export interface WeeklyHubData {
  preview: ScheduleMatchupPreview;
  opponentName: string;
  opponentRecord: { wins: number; losses: number };
  opponentRank: number | null;
  userRank: number | null;
  /** User win probability, 0–100. */
  winProbability: number;
  /** Most-recent-last sequence of user results. */
  recentForm: Array<'W' | 'L'>;
  keyPlayers: HubKeyPlayer[];
  /** Head-to-head with this opponent, filled in by the app from dynasty history. */
  series?: SeriesRecord;
}

export function buildWeeklyHub({
  schedule,
  teams,
  userTeamId,
  currentWeek,
  rankings,
  seasonStats,
}: {
  schedule: ScheduledGame[];
  teams: LacrosseTeam[];
  userTeamId: string;
  currentWeek: number;
  rankings: RankingEntry[];
  seasonStats: SeasonStatsMap;
}): WeeklyHubData | null {
  const preview = getNextUserGamePreview({ schedule, teams, userTeamId, currentWeek });
  if (!preview) return null;

  const { opponent, userTeam, userIsHome, ratingEdge, game } = preview;
  const rankOf = (teamId: string) => rankings.find((r) => r.teamId === teamId)?.rank ?? null;

  const userKey = topPerformer(userTeam, seasonStats, true);
  const oppKey = topPerformer(opponent, seasonStats, false);

  return {
    preview,
    opponentName: opponent.name,
    opponentRecord: { wins: opponent.record.wins, losses: opponent.record.losses },
    opponentRank: rankOf(opponent.id),
    userRank: rankOf(userTeam.id),
    winProbability: winProbability(ratingEdge, userIsHome, game.neutralSite ?? false),
    recentForm: recentForm(schedule, userTeamId),
    keyPlayers: [userKey, oppKey].filter((p): p is HubKeyPlayer => p !== null),
  };
}

/** Pregame win probability, calibrated against the sim (see sport-lacrosse win-probability.ts). */
export function winProbability(ratingEdge: number, userIsHome: boolean, neutral: boolean): number {
  return lacrosseWinProbability(ratingEdge, userIsHome, neutral);
}

function recentForm(schedule: ScheduledGame[], userTeamId: string, count = 5): Array<'W' | 'L'> {
  return schedule
    .filter(
      (g) =>
        g.status === 'final' &&
        g.result !== undefined &&
        (g.homeTeamId === userTeamId || g.awayTeamId === userTeamId),
    )
    .sort((a, b) => a.week - b.week || a.id.localeCompare(b.id))
    .slice(-count)
    .map((g) => (g.result!.winnerTeamId === userTeamId ? 'W' : 'L'));
}

function topPerformer(team: LacrosseTeam, seasonStats: SeasonStatsMap, isUser: boolean): HubKeyPlayer | null {
  const offensive = team.roster.filter((p) => p.position === 'ATT' || p.position === 'MID');
  if (offensive.length === 0) return null;

  let best: { player: LacrosseTeam['roster'][number]; points: number } | null = null;
  for (const player of offensive) {
    const stats = seasonStats[player.id];
    const points = stats ? stats.goals + stats.assists : 0;
    if (!best || points > best.points) best = { player, points };
  }

  // No games played yet → spotlight the highest-rated scorer instead.
  if (!best || best.points <= 0) {
    const topRated = [...offensive].sort((a, b) => b.ratings.overall - a.ratings.overall)[0];
    if (!topRated) return null;
    return {
      playerId: topRated.id,
      name: `${topRated.name.first} ${topRated.name.last}`,
      position: topRated.position,
      line: `${topRated.ratings.overall} OVR`,
      isUser,
    };
  }

  const stats = seasonStats[best.player.id]!;
  return {
    playerId: best.player.id,
    name: `${best.player.name.first} ${best.player.name.last}`,
    position: best.player.position,
    line: `${stats.goals}G ${stats.assists}A`,
    isUser,
  };
}

/** Results the hub shows before "show all". */
export const FEATURED_RESULTS = 6;
/** Ranked teams worth a headline. */
const FEATURED_RANK = 20;

/**
 * The week's results worth reading first: your game, then games with a
 * ranked team (best rank first), then the closest finishes.
 */
export function featuredResults(
  games: readonly ScheduledGame[],
  userTeamId: string,
  rankOf: (teamId: string) => number | null,
  limit = FEATURED_RESULTS,
): ScheduledGame[] {
  const bestRank = (g: ScheduledGame) => {
    const ranks = [rankOf(g.homeTeamId), rankOf(g.awayTeamId)].filter((r): r is number => r !== null && r <= FEATURED_RANK);
    return ranks.length > 0 ? Math.min(...ranks) : Infinity;
  };
  const margin = (g: ScheduledGame) => (g.result ? Math.abs(g.result.homeScore - g.result.awayScore) : Infinity);
  const isUsers = (g: ScheduledGame) => g.homeTeamId === userTeamId || g.awayTeamId === userTeamId;
  return [...games]
    .sort((a, b) => Number(isUsers(b)) - Number(isUsers(a)) || bestRank(a) - bestRank(b) || margin(a) - margin(b))
    .slice(0, limit);
}
