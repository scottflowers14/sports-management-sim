export interface ScoutingState {
  partialIds: Record<string, number>;  // recruitId -> fuzzy OVR
  fullIds: string[];
  pointsAvailable: number;
  pointsPerWeek: number;
}

export function createScoutingState(pointsPerWeek = 3): ScoutingState {
  return { partialIds: {}, fullIds: [], pointsAvailable: pointsPerWeek, pointsPerWeek };
}

export function advanceScoutingWeek(state: ScoutingState): ScoutingState {
  return {
    ...state,
    pointsAvailable: Math.min(state.pointsPerWeek * 4, state.pointsAvailable + state.pointsPerWeek),
  };
}

export function scoutRecruit(
  state: ScoutingState,
  recruitId: string,
  trueOvr: number,
  random: () => number,
): ScoutingState {
  if (state.pointsAvailable <= 0) return state;

  if (recruitId in state.partialIds) {
    // Upgrade partial → full
    const { [recruitId]: _dropped, ...remaining } = state.partialIds;
    return {
      ...state,
      partialIds: remaining,
      fullIds: [...state.fullIds, recruitId],
      pointsAvailable: state.pointsAvailable - 1,
    };
  }

  // First look: show fuzzy OVR (actual ± 8, floored/ceiled to 40–99)
  const noise = Math.round((random() - 0.5) * 16);
  const fuzzyOvr = Math.min(99, Math.max(40, trueOvr + noise));
  return {
    ...state,
    partialIds: { ...state.partialIds, [recruitId]: fuzzyOvr },
    pointsAvailable: state.pointsAvailable - 1,
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
