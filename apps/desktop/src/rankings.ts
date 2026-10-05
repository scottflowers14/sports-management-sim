import { lacrossePollScore, type LacrosseTeam } from '@sports-management-sim/sport-lacrosse';

export interface RankingEntry {
  teamId: string;
  rank: number;
  previousRank: number;
  score: number;
}

export function computeNationalRankings(
  teams: LacrosseTeam[],
  previousRankings: RankingEntry[],
): RankingEntry[] {
  const previousRankMap = new Map<string, number>(
    previousRankings.map((entry) => [entry.teamId, entry.rank]),
  );

  const scored = teams.map((team) => ({ teamId: team.id, score: lacrossePollScore(team) }));

  scored.sort((a, b) => b.score - a.score);

  return scored.map((entry, index) => {
    const rank = index + 1;
    return {
      teamId: entry.teamId,
      rank,
      previousRank: previousRankMap.get(entry.teamId) ?? rank,
      score: entry.score,
    };
  });
}

/**
 * The final poll, voted after the title game: the national champion is #1
 * and everyone it passed slides down a spot.
 */
export function finalPollRank(
  rankings: readonly Pick<RankingEntry, 'teamId' | 'rank'>[],
  teamId: string,
  championId: string | null | undefined,
): number | null {
  const rank = rankings.find((r) => r.teamId === teamId)?.rank ?? null;
  if (!championId) return rank;
  if (teamId === championId) return 1;
  if (rank === null) return null;
  const championRank = rankings.find((r) => r.teamId === championId)?.rank ?? Infinity;
  return championRank > rank ? rank + 1 : rank;
}

/**
 * The whole final poll, with the champion at #1 and the teams it passed each
 * sliding down a spot. previousRank keeps the last regular-season rank.
 */
export function finalPoll(rankings: readonly RankingEntry[], championId: string | null | undefined): RankingEntry[] {
  return rankings
    .map((entry) => ({
      ...entry,
      rank: finalPollRank(rankings, entry.teamId, championId) ?? entry.rank,
      previousRank: entry.rank,
    }))
    .sort((a, b) => a.rank - b.rank);
}
