/**
 * A coach's legacy: one number for a career, so a long steady run and a short
 * title-winning stint can be compared on the profile. Titles count most, then
 * conference crowns, then wins, with a little extra for winning by a margin.
 */
export interface LegacyInput {
  wins: number;
  losses: number;
  confTitles: number;
  nationalTitles: number;
}

export function legacyScore(c: LegacyInput): number {
  return Math.round(c.wins + c.confTitles * 12 + c.nationalTitles * 50 + Math.max(0, c.wins - c.losses) * 0.5);
}

export const LEGACY_TIERS: readonly { min: number; label: string }[] = [
  { min: 750, label: 'Legend' },
  { min: 450, label: 'Hall of Fame' },
  { min: 250, label: 'Elite' },
  { min: 120, label: 'Established' },
  { min: 40, label: 'Respected' },
  { min: 0, label: 'Up-and-Comer' },
];

export function legacyTier(score: number): string {
  return LEGACY_TIERS.find((t) => score >= t.min)!.label;
}

/** The next tier up and the score it needs, or null at the top. */
export function nextLegacyTier(score: number): { min: number; label: string } | null {
  return [...LEGACY_TIERS].reverse().find((t) => t.min > score) ?? null;
}
