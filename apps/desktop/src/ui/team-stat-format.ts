import type { TeamStatKey } from '@sports-management-sim/sport-lacrosse';

/** Column headers for team stats. */
export const TEAM_STAT_SHORT: Record<TeamStatKey, string> = {
  goalsFor: 'GF/G',
  goalsAgainst: 'GA/G',
  margin: 'Margin',
  shootingPct: 'Sh%',
  faceoffPct: 'FO%',
  clearPct: 'Clr%',
  turnovers: 'TO/G',
  causedTurnovers: 'CT/G',
};

export function formatTeamStat(key: TeamStatKey, value: number): string {
  if (key === 'shootingPct' || key === 'faceoffPct' || key === 'clearPct') return `${(value * 100).toFixed(1)}%`;
  if (key === 'margin') return `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
  return value.toFixed(1);
}
