import type { ScheduledGame } from '@sports-management-sim/engine-core';
import { teamTendencies, type TeamTendencies } from './scouting-report';

/** The team stat columns, each ranked across the league. */
export type TeamStatKey =
  | 'goalsFor'
  | 'goalsAgainst'
  | 'margin'
  | 'shootingPct'
  | 'faceoffPct'
  | 'clearPct'
  | 'turnovers'
  | 'causedTurnovers';

export const TEAM_STAT_KEYS: readonly TeamStatKey[] = [
  'goalsFor',
  'goalsAgainst',
  'margin',
  'shootingPct',
  'faceoffPct',
  'clearPct',
  'turnovers',
  'causedTurnovers',
];

export const TEAM_STAT_LABELS: Record<TeamStatKey, string> = {
  goalsFor: 'Scoring offense',
  goalsAgainst: 'Scoring defense',
  margin: 'Scoring margin',
  shootingPct: 'Shooting %',
  faceoffPct: 'Faceoff %',
  clearPct: 'Clearing %',
  turnovers: 'Turnovers',
  causedTurnovers: 'Caused turnovers',
};

/** Stats where a lower number is better: they rank ascending. */
const LOWER_IS_BETTER: ReadonlySet<TeamStatKey> = new Set(['goalsAgainst', 'turnovers']);

export function lowerIsBetter(key: TeamStatKey): boolean {
  return LOWER_IS_BETTER.has(key);
}

export interface TeamStatRow {
  teamId: string;
  games: number;
  values: Record<TeamStatKey, number>;
  /** National rank in each stat, 1 = best. Ties share a rank. */
  ranks: Record<TeamStatKey, number>;
}

function valuesOf(t: TeamTendencies): Record<TeamStatKey, number> {
  return {
    goalsFor: t.goalsFor,
    goalsAgainst: t.goalsAgainst,
    margin: t.goalsFor - t.goalsAgainst,
    shootingPct: t.shootingPct,
    faceoffPct: t.faceoffPct,
    clearPct: t.clearPct,
    turnovers: t.turnovers,
    causedTurnovers: t.causedTurnovers,
  };
}

/**
 * Every team with a box score this season, its per-game numbers and its
 * national rank in each. Teams without a game yet are left out.
 */
export function teamStatRankings(schedule: readonly ScheduledGame[], teamIds: readonly string[]): TeamStatRow[] {
  const rows: TeamStatRow[] = [];
  for (const teamId of teamIds) {
    const t = teamTendencies(schedule, teamId);
    if (!t) continue;
    rows.push({ teamId, games: t.games, values: valuesOf(t), ranks: {} as Record<TeamStatKey, number> });
  }
  for (const key of TEAM_STAT_KEYS) {
    const dir = lowerIsBetter(key) ? 1 : -1;
    // Compare on rounded values so ties the table shows as equal share a rank.
    const shown = (r: TeamStatRow) => Math.round(r.values[key] * 1000);
    const sorted = [...rows].sort((a, b) => dir * (shown(a) - shown(b)));
    sorted.forEach((row, i) => {
      const prev = sorted[i - 1];
      row.ranks[key] = prev && shown(prev) === shown(row) ? prev.ranks[key] : i + 1;
    });
  }
  return rows;
}

/** Sort rows best-first by one stat, breaking ties by team id for a stable order. */
export function sortTeamStats(rows: readonly TeamStatRow[], key: TeamStatKey): TeamStatRow[] {
  return [...rows].sort((a, b) => a.ranks[key] - b.ranks[key] || a.teamId.localeCompare(b.teamId));
}

/**
 * A team's best and worst national ranks, for a one-line read on what it does
 * well. Returns null when the team has no games.
 */
export function teamStatHighlights(
  rows: readonly TeamStatRow[],
  teamId: string,
): { best: { key: TeamStatKey; rank: number }; worst: { key: TeamStatKey; rank: number } } | null {
  const row = rows.find((r) => r.teamId === teamId);
  if (!row) return null;
  let best = { key: TEAM_STAT_KEYS[0]!, rank: row.ranks[TEAM_STAT_KEYS[0]!] };
  let worst = best;
  for (const key of TEAM_STAT_KEYS) {
    const rank = row.ranks[key];
    if (rank < best.rank) best = { key, rank };
    if (rank > worst.rank) worst = { key, rank };
  }
  return { best, worst };
}
