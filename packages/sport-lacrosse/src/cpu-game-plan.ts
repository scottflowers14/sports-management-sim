import {
  DEFENSE_LABELS,
  RIDE_LABELS,
  ROTATION_LABELS,
  TEMPO_LABELS,
  normalizeGamePlan,
  type DefensiveStyle,
  type LacrosseGamePlan,
  type MidfieldRotation,
  type OffensiveTempo,
  type RideStyle,
} from './game-plan';
import { buildLacrosseLineup } from './lineups';
import type { LacrosseTeam } from './models';
import { calculateLacrosseTeamRating } from './team-rating';

/**
 * Derive a CPU team's game plan from its roster identity:
 * offense-heavy teams push tempo, defense-first teams slow it down,
 * a dominant faceoff unit plays for extra possessions, the defensive style
 * follows whether the unit or the goalie is the strength, athletic attacks
 * ride hard, and the midfield rotation follows how steep the drop-off is
 * from the first line to the second.
 */
export function deriveCpuGamePlan(team: LacrosseTeam): LacrosseGamePlan {
  const rating = calculateLacrosseTeamRating(team);
  const lineup = buildLacrosseLineup(team);

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

  const attackAthleticism = average(lineup.attack.map((p) => p.ratings.athleticism));
  let ride: RideStyle = 'standard';
  if (attackAthleticism >= 68 && tempo !== 'patient') ride = 'aggressive';
  else if (attackAthleticism < 52 || defense === 'shell') ride = 'conservative';

  const line1 = average((lineup.midfieldLines[0] ?? []).map((p) => p.ratings.overall));
  const line2 = average((lineup.midfieldLines[1] ?? []).map((p) => p.ratings.overall));
  const line1Stamina = average((lineup.midfieldLines[0] ?? []).map((p) => p.ratings.stamina));
  let rotation: MidfieldRotation = 'balanced';
  if (lineup.midfieldLines.length < 3 || (line1 - line2 >= 7 && line1Stamina >= 55)) rotation = 'tight';
  else if (line1 - line2 <= 3 && lineup.midfieldLines.length >= 3) rotation = 'deep';

  return { tempo, defense, ride, rotation };
}

export function describeGamePlan(plan: Partial<LacrosseGamePlan>): string {
  const full = normalizeGamePlan(plan);
  return [
    TEMPO_LABELS[full.tempo].label,
    DEFENSE_LABELS[full.defense].label,
    `${RIDE_LABELS[full.ride].label} ride`,
    `${ROTATION_LABELS[full.rotation].label} rotation`,
  ].join(' · ');
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length;
}
