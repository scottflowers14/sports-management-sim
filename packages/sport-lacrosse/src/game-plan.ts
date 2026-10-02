export type OffensiveTempo = 'uptempo' | 'balanced' | 'patient';
export type DefensiveStyle = 'pressure' | 'balanced' | 'shell';
export type RideStyle = 'aggressive' | 'standard' | 'conservative';
export type MidfieldRotation = 'tight' | 'balanced' | 'deep';

/**
 * The four tactical decisions a coach makes before every game. Each one is a
 * trade-off the possession engine plays out; none is strictly better.
 */
export interface LacrosseGamePlan {
  tempo: OffensiveTempo;
  defense: DefensiveStyle;
  /** How hard the attack rides the opponent's clear. */
  ride: RideStyle;
  /** How the midfield lines split the shifts. */
  rotation: MidfieldRotation;
}

export const DEFAULT_GAME_PLAN: LacrosseGamePlan = {
  tempo: 'balanced',
  defense: 'balanced',
  ride: 'standard',
  rotation: 'balanced',
};

/** Fill in any axis an older save or caller left out. */
export function normalizeGamePlan(plan?: Partial<LacrosseGamePlan> | null): LacrosseGamePlan {
  return { ...DEFAULT_GAME_PLAN, ...(plan ?? {}) };
}

/**
 * What a game plan does inside the possession engine. Multipliers are 1 at
 * balanced; probabilities are additive deltas on the balanced baseline.
 */
export interface TacticEffects {
  /** Multiplier on how long each offensive possession takes. */
  possessionLength: number;
  /** Delta on the chance a shot on goal beats the keeper. */
  shotQuality: number;
  /** Multiplier on the planning team's own turnover rate. */
  turnoverRate: number;
  /** Multiplier on how often the defense takes the ball away. */
  forceTurnovers: number;
  /** Delta on the shot quality the defense concedes. */
  shotQualityAllowed: number;
  /** Multiplier on how often the defense gets flagged. */
  penaltyRate: number;
  /** Added to the opponent's chance of failing a clear. */
  rideClearFailure: number;
  /** Chance a successful opponent clear turns into a fast break the other way. */
  rideTransitionAllowed: number;
  /** Share of midfield shifts for lines 1, 2 and 3. */
  lineShares: number[];
}

const TEMPO_EFFECTS: Record<OffensiveTempo, Pick<TacticEffects, 'possessionLength' | 'shotQuality' | 'turnoverRate'>> = {
  // Push the ball: more possessions for both teams, rushed looks, more giveaways.
  uptempo: { possessionLength: 0.74, shotQuality: -0.035, turnoverRate: 1.14 },
  balanced: { possessionLength: 1, shotQuality: 0, turnoverRate: 1 },
  // Work the offense: fewer possessions, better looks, fewer giveaways.
  patient: { possessionLength: 1.32, shotQuality: 0.04, turnoverRate: 0.9 },
};

const DEFENSE_EFFECTS: Record<DefensiveStyle, Pick<TacticEffects, 'forceTurnovers' | 'shotQualityAllowed' | 'penaltyRate'>> = {
  // Slide early and throw checks: takeaways, but easy goals and flags when beaten.
  pressure: { forceTurnovers: 1.32, shotQualityAllowed: 0.035, penaltyRate: 1.35 },
  balanced: { forceTurnovers: 1, shotQualityAllowed: 0, penaltyRate: 1 },
  // Pack it in: fewer takeaways, every shot contested, few penalties.
  shell: { forceTurnovers: 0.82, shotQualityAllowed: -0.038, penaltyRate: 0.8 },
};

const RIDE_EFFECTS: Record<RideStyle, Pick<TacticEffects, 'rideClearFailure' | 'rideTransitionAllowed'>> = {
  // Ten-man ride: the opponent fails more clears, but a broken ride is a fast break.
  aggressive: { rideClearFailure: 0.07, rideTransitionAllowed: 0.26 },
  standard: { rideClearFailure: 0, rideTransitionAllowed: 0.12 },
  // Get back and set the defense: clears come easy, transition never does.
  conservative: { rideClearFailure: -0.035, rideTransitionAllowed: 0.04 },
};

export const ROTATION_SHARES: Record<MidfieldRotation, number[]> = {
  // Ride the first line: the best players play the most, and tire by the fourth quarter.
  tight: [0.62, 0.3, 0.08],
  balanced: [0.46, 0.34, 0.2],
  // Roll three lines: fresh legs all game, less talent on the field at a time.
  deep: [0.38, 0.33, 0.29],
};

export function getTacticEffects(plan: LacrosseGamePlan): TacticEffects {
  const full = normalizeGamePlan(plan);
  return {
    ...TEMPO_EFFECTS[full.tempo],
    ...DEFENSE_EFFECTS[full.defense],
    ...RIDE_EFFECTS[full.ride],
    lineShares: ROTATION_SHARES[full.rotation],
  };
}

export const TEMPO_LABELS: Record<OffensiveTempo, { label: string; hint: string }> = {
  uptempo: { label: 'Uptempo', hint: 'Push transition: more possessions, rushed shots, more giveaways' },
  balanced: { label: 'Balanced', hint: 'Take what the defense gives' },
  patient: { label: 'Patient', hint: 'Work the offense: fewer possessions, better looks' },
};

export const DEFENSE_LABELS: Record<DefensiveStyle, { label: string; hint: string }> = {
  pressure: { label: 'Pressure', hint: 'Slide early and throw checks: takeaways, but easy goals and penalties when beaten' },
  balanced: { label: 'Balanced', hint: 'Sound positional defense' },
  shell: { label: 'Shell', hint: 'Pack it in: contest every shot, concede possession' },
};

export const RIDE_LABELS: Record<RideStyle, { label: string; hint: string }> = {
  aggressive: { label: 'Aggressive', hint: 'Ten-man ride: force failed clears, give up fast breaks when it breaks down' },
  standard: { label: 'Standard', hint: 'Ride through midfield, then get back' },
  conservative: { label: 'Conservative', hint: 'Get back and set the defense: no cheap clears forced, no transition allowed' },
};

export const ROTATION_LABELS: Record<MidfieldRotation, { label: string; hint: string }> = {
  tight: { label: 'Tight', hint: 'First line takes most shifts: the best players play, and tire late' },
  balanced: { label: 'Balanced', hint: 'Two full lines with a third in relief' },
  deep: { label: 'Deep', hint: 'Roll three lines: fresh legs all game, less talent on the field at once' },
};
