/**
 * Weekly recruiting-hours pool and scouted knowledge. Hours are one budget spent
 * across every recruiting verb: scouting reports, pitches, flip pitches, and
 * campus visits all draw from the same pool, so working one recruit hard means
 * another goes cold.
 */
export interface ScoutingState {
  partialIds: Record<string, number>;  // recruitId -> fuzzy OVR
  fullIds: string[];
  pointsAvailable: number;
  pointsPerWeek: number;
}

export const RECRUITING_HOURS_PER_WEEK = 6;

/** Hour costs for each recruiting action. */
export const HOURS_COST = {
  scout: 1,
  pitch: 1,
  flipPitch: 2,
  visit: 3,
} as const;

export function createScoutingState(pointsPerWeek = RECRUITING_HOURS_PER_WEEK): ScoutingState {
  return { partialIds: {}, fullIds: [], pointsAvailable: pointsPerWeek, pointsPerWeek };
}

export function advanceScoutingWeek(state: ScoutingState): ScoutingState {
  return {
    ...state,
    pointsAvailable: Math.min(state.pointsPerWeek * 4, state.pointsAvailable + state.pointsPerWeek),
  };
}

/** Spend recruiting hours; returns null when the pool can't cover the cost. */
export function spendRecruitingHours(state: ScoutingState, cost: number): ScoutingState | null {
  if (state.pointsAvailable < cost) return null;
  return { ...state, pointsAvailable: state.pointsAvailable - cost };
}

export function scoutRecruit(
  state: ScoutingState,
  recruitId: string,
  trueOvr: number,
  random: () => number,
): ScoutingState {
  if (state.pointsAvailable < HOURS_COST.scout) return state;

  if (recruitId in state.partialIds) {
    // Upgrade partial → full
    const { [recruitId]: _dropped, ...remaining } = state.partialIds;
    return {
      ...state,
      partialIds: remaining,
      fullIds: [...state.fullIds, recruitId],
      pointsAvailable: state.pointsAvailable - HOURS_COST.scout,
    };
  }

  // First look: show fuzzy OVR (actual ± 8, floored/ceiled to 40–99)
  const noise = Math.round((random() - 0.5) * 16);
  const fuzzyOvr = Math.min(99, Math.max(40, trueOvr + noise));
  return {
    ...state,
    partialIds: { ...state.partialIds, [recruitId]: fuzzyOvr },
    pointsAvailable: state.pointsAvailable - HOURS_COST.scout,
  };
}

export function resetScoutingForNewClass(state: ScoutingState): ScoutingState {
  return { ...createScoutingState(state.pointsPerWeek), pointsAvailable: state.pointsAvailable };
}

export function getDisplayOvr(
  recruitId: string,
  trueOvr: number,
  state: ScoutingState,
): number | null {
  if (state.fullIds.includes(recruitId)) return trueOvr;
  return state.partialIds[recruitId] ?? null;
}

export function getScoutTier(
  recruitId: string,
  state: ScoutingState,
): 'none' | 'partial' | 'full' {
  if (state.fullIds.includes(recruitId)) return 'full';
  if (recruitId in state.partialIds) return 'partial';
  return 'none';
}
