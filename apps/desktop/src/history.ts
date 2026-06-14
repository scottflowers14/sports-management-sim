import type { LacrosseTeam } from '@sports-management-sim/sport-lacrosse';
import type { SeasonAwards } from './awards';
import type { SeasonStatsMap } from './stats';

/** A national award winner captured for the permanent dynasty record. */
export interface SeasonAwardRecord {
  /** Short award label, e.g. "MVP", "Offensive POY". */
  award: string;
  playerName: string;
  /** Raw team name/id — format with formatTeamName for display. */
  teamName: string;
  position: string;
  /** Production line, e.g. "34G, 21A", when available. */
  statLine?: string;
}

/** The user program's leading scorer for a single season. */
export interface SeasonLeaderRecord {
  playerName: string;
  position: string;
  goals: number;
  assists: number;
  points: number;
}

export interface DynastySeasonRecord {
  year: number;
  wins: number;
  losses: number;
  confStanding: number;
  natRankAtEnd: number | null;
  confChampion: boolean;
  nationalChampion: boolean;
  signingClassSize: number;
  // ── enriched history (optional for backward-compatible save loading) ─────────
  /** Head coach of the user program that season. */
  coachName?: string;
  /** User program name that season (coaches can change jobs mid-dynasty). */
  teamName?: string;
  /** Team that won the national championship that season, if decided. */
  nationalChampionName?: string;
  /** National award winners (MVP, OPOY, DPOY, Freshman). */
  awards?: SeasonAwardRecord[];
  /** The user program's leading scorer that season. */
  teamLeader?: SeasonLeaderRecord;
}

/** Flatten the computed season awards into the slim records stored in history. */
export function toSeasonAwardRecords(awards: SeasonAwards | null): SeasonAwardRecord[] {
  if (!awards) return [];
  const records: SeasonAwardRecord[] = [
    { award: 'MVP', ...pickFields(awards.mvp) },
    { award: 'Offensive POY', ...pickFields(awards.offensivePlayer) },
    { award: 'Defensive POY', ...pickFields(awards.defensivePlayer) },
  ];
  if (awards.freshmanOfYear) {
    records.push({ award: 'Freshman of the Year', ...pickFields(awards.freshmanOfYear) });
  }
  return records;
}

function pickFields(winner: SeasonAwards['mvp']): Omit<SeasonAwardRecord, 'award'> {
  return {
    playerName: winner.playerName,
    teamName: winner.teamName,
    position: winner.position,
    ...(winner.statLine !== undefined ? { statLine: winner.statLine } : {}),
  };
}

/** Find the user program's leading scorer (goals + assists) for the season. */
export function deriveSeasonLeader(
  team: LacrosseTeam | undefined,
  seasonStats: SeasonStatsMap,
): SeasonLeaderRecord | undefined {
  if (!team) return undefined;
  let best: SeasonLeaderRecord | undefined;
  for (const player of team.roster) {
    const stats = seasonStats[player.id];
    if (!stats || stats.gamesPlayed === 0) continue;
    const points = stats.goals + stats.assists;
    if (points <= 0) continue;
    if (!best || points > best.points) {
      best = {
        playerName: `${player.name.first} ${player.name.last}`,
        position: player.position,
        goals: stats.goals,
        assists: stats.assists,
        points,
      };
    }
  }
  return best;
}

export interface DynastyRecordBook {
  mostWins: { value: number; year: number } | null;
  bestScoringSeason: { value: number; player: string; year: number } | null;
  bestFinish: { value: number; year: number } | null;
  confTitles: number;
  natTitles: number;
  longestWinStreakSeasons: number;
}

/** Derive single-season program records and milestones from the full history. */
export function buildRecordBook(history: DynastySeasonRecord[]): DynastyRecordBook {
  let mostWins: DynastyRecordBook['mostWins'] = null;
  let bestScoringSeason: DynastyRecordBook['bestScoringSeason'] = null;
  let bestFinish: DynastyRecordBook['bestFinish'] = null;
  let confTitles = 0;
  let natTitles = 0;
  let longestWinStreakSeasons = 0;
  let currentStreak = 0;

  // History is stored newest-first; walk oldest-first for streak continuity.
  for (const record of [...history].reverse()) {
    if (!mostWins || record.wins > mostWins.value) {
      mostWins = { value: record.wins, year: record.year };
    }
    if (record.teamLeader && (!bestScoringSeason || record.teamLeader.points > bestScoringSeason.value)) {
      bestScoringSeason = {
        value: record.teamLeader.points,
        player: record.teamLeader.playerName,
        year: record.year,
      };
    }
    if (record.natRankAtEnd !== null && (!bestFinish || record.natRankAtEnd < bestFinish.value)) {
      bestFinish = { value: record.natRankAtEnd, year: record.year };
    }
    if (record.confChampion) confTitles += 1;
    if (record.nationalChampion) natTitles += 1;

    if (record.wins > record.losses) {
      currentStreak += 1;
      longestWinStreakSeasons = Math.max(longestWinStreakSeasons, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  return { mostWins, bestScoringSeason, bestFinish, confTitles, natTitles, longestWinStreakSeasons };
}
