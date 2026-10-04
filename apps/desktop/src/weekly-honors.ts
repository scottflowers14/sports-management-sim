import type { LacrosseTeam } from '@sports-management-sim/sport-lacrosse';
import { defensiveProduction } from './awards';
import type { NewsItem } from './news-feed';
import type { PlayerSeasonStats, SeasonStatsMap } from './stats';

export type WeeklyHonorKind = 'offense' | 'defense';

export const WEEKLY_HONOR_LABELS: Record<WeeklyHonorKind, string> = {
  offense: 'Player of the Week',
  defense: 'Defensive Player of the Week',
};

export interface WeeklyHonor {
  week: number;
  kind: WeeklyHonorKind;
  playerId: string;
  teamId: string;
  /** e.g. "4G, 2A" or "14 saves". */
  line: string;
}

type WeekLine = Omit<PlayerSeasonStats, 'playerId' | 'gamesPlayed'>;

function weekLine(after: PlayerSeasonStats, before: PlayerSeasonStats | undefined): WeekLine {
  return {
    goals: after.goals - (before?.goals ?? 0),
    assists: after.assists - (before?.assists ?? 0),
    shots: after.shots - (before?.shots ?? 0),
    groundBalls: after.groundBalls - (before?.groundBalls ?? 0),
    turnovers: after.turnovers - (before?.turnovers ?? 0),
    causedTurnovers: after.causedTurnovers - (before?.causedTurnovers ?? 0),
    faceoffWins: after.faceoffWins - (before?.faceoffWins ?? 0),
    faceoffAttempts: after.faceoffAttempts - (before?.faceoffAttempts ?? 0),
    saves: after.saves - (before?.saves ?? 0),
    goalsAllowed: after.goalsAllowed - (before?.goalsAllowed ?? 0),
  };
}

const DEFENSIVE_POSITIONS = new Set(['DEF', 'LSM', 'GK']);

function defensiveLineText(position: string, line: WeekLine): string {
  if (position === 'GK') return `${line.saves} saves`;
  return `${line.causedTurnovers} CT, ${line.groundBalls} GB`;
}

/**
 * The week's two national honors: the best scoring line, and the best
 * defensive game by a defenseman, LSM or goalie.
 */
export function pickWeeklyHonors(
  week: number,
  before: SeasonStatsMap,
  after: SeasonStatsMap,
  teams: LacrosseTeam[],
): WeeklyHonor[] {
  let offense: { honor: WeeklyHonor; score: number } | null = null;
  let defense: { honor: WeeklyHonor; score: number } | null = null;

  for (const team of teams) {
    for (const player of team.roster) {
      const stats = after[player.id];
      if (!stats || stats.gamesPlayed === (before[player.id]?.gamesPlayed ?? 0)) continue;
      const line = weekLine(stats, before[player.id]);

      const offenseScore = line.goals * 2 + line.assists;
      if (offenseScore > 0 && (!offense || offenseScore > offense.score)) {
        offense = {
          score: offenseScore,
          honor: { week, kind: 'offense', playerId: player.id, teamId: team.id, line: `${line.goals}G, ${line.assists}A` },
        };
      }

      if (DEFENSIVE_POSITIONS.has(player.position)) {
        const defenseScore = defensiveProduction(player.position, line);
        if (defenseScore > 0 && (!defense || defenseScore > defense.score)) {
          defense = {
            score: defenseScore,
            honor: { week, kind: 'defense', playerId: player.id, teamId: team.id, line: defensiveLineText(player.position, line) },
          };
        }
      }
    }
  }

  return [offense?.honor, defense?.honor].filter((honor): honor is WeeklyHonor => honor !== undefined);
}

export function weeklyHonorNews(honors: WeeklyHonor[], teams: LacrosseTeam[], userTeamId: string): NewsItem[] {
  const teamById = new Map(teams.map((team) => [team.id, team]));
  return honors.flatMap((honor) => {
    const team = teamById.get(honor.teamId);
    const player = team?.roster.find((p) => p.id === honor.playerId);
    if (!team || !player) return [];
    return [{
      id: `potw-${honor.week}-${honor.kind}`,
      week: honor.week,
      category: 'award' as const,
      ...(honor.teamId === userTeamId ? { featured: true } : {}),
      headline: `${WEEKLY_HONOR_LABELS[honor.kind]}: ${player.position} ${player.name.first} ${player.name.last} (${team.name}), ${honor.line}`,
    }];
  });
}

/** Weekly honors won this season, by player. */
export function weeklyHonorCounts(honors: readonly WeeklyHonor[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const honor of honors) counts[honor.playerId] = (counts[honor.playerId] ?? 0) + 1;
  return counts;
}
