export type OffensiveTempo = 'uptempo' | 'balanced' | 'patient';
export type DefensiveStyle = 'pressure' | 'balanced' | 'shell';

export interface LacrosseGamePlan {
  tempo: OffensiveTempo;
  defense: DefensiveStyle;
}

export const DEFAULT_GAME_PLAN: LacrosseGamePlan = { tempo: 'balanced', defense: 'balanced' };

/**
 * Per-game simulation adjustments produced by a game plan.
 * `own*` applies to the planning team, `opp*` to its opponent.
 */
export interface GamePlanModifiers {
  ownPossessions: number;
  ownScoringChance: number;
  oppPossessions: number;
  oppScoringChance: number;
}

const TEMPO_MODIFIERS: Record<OffensiveTempo, Pick<GamePlanModifiers, 'ownPossessions' | 'ownScoringChance'>> = {
  // More possessions but rushed looks
  uptempo: { ownPossessions: 5, ownScoringChance: -0.015 },
  balanced: { ownPossessions: 0, ownScoringChance: 0 },
  // Fewer possessions but higher-quality shots
  patient: { ownPossessions: -5, ownScoringChance: 0.014 },
};

const DEFENSE_MODIFIERS: Record<DefensiveStyle, Pick<GamePlanModifiers, 'oppPossessions' | 'oppScoringChance'>> = {
  // Forces turnovers (fewer opponent possessions) but gives up easier goals when beaten
  pressure: { oppPossessions: -4, oppScoringChance: 0.02 },
  balanced: { oppPossessions: 0, oppScoringChance: 0 },
  // Concedes possession but contests every shot
  shell: { oppPossessions: 3, oppScoringChance: -0.016 },
};

export function getGamePlanModifiers(plan: LacrosseGamePlan): GamePlanModifiers {
  return {
    ...TEMPO_MODIFIERS[plan.tempo],
    ...DEFENSE_MODIFIERS[plan.defense],
  };
}

export const TEMPO_LABELS: Record<OffensiveTempo, { label: string; hint: string }> = {
  uptempo: { label: 'Uptempo', hint: 'Push transition: more possessions, rushed shots' },
  balanced: { label: 'Balanced', hint: 'Take what the defense gives' },
  patient: { label: 'Patient', hint: 'Work the offense: fewer possessions, better looks' },
};

export const DEFENSE_LABELS: Record<DefensiveStyle, { label: string; hint: string }> = {
  pressure: { label: 'Pressure', hint: 'Force turnovers, risk easy goals when beaten' },
  balanced: { label: 'Balanced', hint: 'Sound positional defense' },
  shell: { label: 'Shell', hint: 'Pack it in: concede possession, contest every shot' },
};
