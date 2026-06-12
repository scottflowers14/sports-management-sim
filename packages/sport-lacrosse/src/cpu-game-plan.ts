import { DEFENSE_LABELS, TEMPO_LABELS, type DefensiveStyle, type LacrosseGamePlan, type OffensiveTempo } from './game-plan';
import type { LacrosseTeam } from './models';
import { calculateLacrosseTeamRating } from './team-rating';

/**
 * Derive a CPU team's game plan from its roster identity:
 * offense-heavy teams push tempo, defense-first teams slow it down,
 * a dominant faceoff unit plays for extra possessions, and the
 * defensive style follows whether the unit or the goalie is the strength.
 */
export function deriveCpuGamePlan(team: LacrosseTeam): LacrosseGamePlan {
  const rating = calculateLacrosseTeamRating(team);

  let tempo: OffensiveTempo = 'balanced';
  if (rating.offense - rating.defense >= 5 || rating.faceoff - rating.overall >= 8) {
    tempo = 'uptempo';
  } else if (rating.defense - rating.offense >= 5) {
    tempo = 'patient';
  }

  let defense: DefensiveStyle = 'balanced';
  if (rating.defense - rating.goalie >= 5) {
    defense = 'pressure';
  } else if (rating.goalie - rating.defense >= 5) {
    defense = 'shell';
  }

  return { tempo, defense };
}

export function describeGamePlan(plan: LacrosseGamePlan): string {
  return `${TEMPO_LABELS[plan.tempo].label} · ${DEFENSE_LABELS[plan.defense].label}`;
}
