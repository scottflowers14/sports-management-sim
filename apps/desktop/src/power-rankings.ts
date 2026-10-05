import type { ScheduledGame } from '@sports-management-sim/engine-core';
import type { RankingEntry } from './rankings';

export interface PowerRankingBlurb {
  teamId: string;
  rank: number;
  change: number;
  blurb: string;
}

/** How many teams get a write-up. */
export const POWER_RANKINGS_SIZE = 10;

function teamGames(schedule: readonly ScheduledGame[], teamId: string): ScheduledGame[] {
  return schedule
    .filter((g) => g.status === 'final' && g.result && (g.homeTeamId === teamId || g.awayTeamId === teamId))
    .sort((a, b) => a.week - b.week || a.id.localeCompare(b.id));
}

/** Current streak: positive for wins, negative for losses. */
export function streakOf(schedule: readonly ScheduledGame[], teamId: string): number {
  const games = teamGames(schedule, teamId);
  let streak = 0;
  for (let i = games.length - 1; i >= 0; i -= 1) {
    const won = games[i]!.result!.winnerTeamId === teamId;
    if (streak === 0) streak = won ? 1 : -1;
    else if (won === streak > 0) streak += won ? 1 : -1;
    else break;
  }
  return streak;
}

/**
 * A weekly power rankings write-up, the kind a beat writer posts: the last
 * result, the streak, ranked wins and what's next, for each of the top ten.
 */
export function powerRankingBlurbs(
  rankings: readonly RankingEntry[],
  schedule: readonly ScheduledGame[],
  teamName: (teamId: string) => string,
  currentWeek: number,
): PowerRankingBlurb[] {
  const rankOf = new Map(rankings.map((r) => [r.teamId, r.rank]));
  const ranked = (teamId: string) => {
    const r = rankOf.get(teamId);
    return r !== undefined && r <= POWER_RANKINGS_SIZE ? `#${r} ${teamName(teamId)}` : teamName(teamId);
  };
  return [...rankings]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, POWER_RANKINGS_SIZE)
    .map((entry) => {
      const { teamId } = entry;
      const games = teamGames(schedule, teamId);
      const sentences: string[] = [];
      const last = games[games.length - 1];
      if (last?.result) {
        const opp = last.homeTeamId === teamId ? last.awayTeamId : last.homeTeamId;
        const won = last.result.winnerTeamId === teamId;
        const ours = last.homeTeamId === teamId ? last.result.homeScore : last.result.awayScore;
        const theirs = last.homeTeamId === teamId ? last.result.awayScore : last.result.homeScore;
        const margin = Math.abs(ours - theirs);
        const ot = last.result.overtime ? ' in overtime' : '';
        const verb = won ? (margin >= 6 ? 'Rolled' : margin === 1 ? 'Edged' : 'Beat') : margin === 1 ? 'Fell just short against' : 'Lost to';
        sentences.push(`${verb} ${ranked(opp)} ${Math.max(ours, theirs)}-${Math.min(ours, theirs)}${ot}.`);
      } else {
        sentences.push('Has yet to take the field.');
      }
      const streak = streakOf(games, teamId);
      if (streak >= 3) sentences.push(`Winners of ${streak} straight.`);
      else if (streak <= -2) sentences.push(`Has dropped ${-streak} in a row.`);
      const rankedWins = games.filter((g) => {
        if (g.result!.winnerTeamId !== teamId) return false;
        const r = rankOf.get(g.result!.loserTeamId);
        return r !== undefined && r <= POWER_RANKINGS_SIZE;
      }).length;
      if (rankedWins >= 2) sentences.push(`${rankedWins} wins over current top-10 teams.`);
      const change = entry.previousRank - entry.rank;
      if (change >= 3) sentences.push(`Up ${change} spots.`);
      else if (change <= -3) sentences.push(`Down ${-change} spots.`);
      const next = schedule
        .filter((g) => g.status === 'scheduled' && g.week >= currentWeek && (g.homeTeamId === teamId || g.awayTeamId === teamId))
        .sort((a, b) => a.week - b.week)[0];
      if (next) {
        const opp = next.homeTeamId === teamId ? next.awayTeamId : next.homeTeamId;
        const r = rankOf.get(opp);
        if (r !== undefined && r <= POWER_RANKINGS_SIZE) {
          sentences.push(`Next: ${next.neutralSite ? 'vs' : next.homeTeamId === teamId ? 'hosts' : 'at'} #${r} ${teamName(opp)}.`);
        }
      }
      return { teamId, rank: entry.rank, change, blurb: sentences.join(' ') };
    });
}
