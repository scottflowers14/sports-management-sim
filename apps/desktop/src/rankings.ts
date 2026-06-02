import type { LacrosseTeam } from '@sports-management-sim/sport-lacrosse';

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

  const scored = teams.map((team) => {
    const wins = team.record.wins;
    const losses = team.record.losses;
    const winPct = wins / Math.max(1, wins + losses);
    const score = Math.round(
      winPct * 60 + team.reputation.nationalPrestige / 5 + team.reputation.recentSuccess / 10,
    );
    return { teamId: team.id, score };
  });

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
