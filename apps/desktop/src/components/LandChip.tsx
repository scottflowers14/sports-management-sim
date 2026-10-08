import type { LandChance } from '../recruit-odds';

const SLUG = { Likely: 'likely', 'Toss-up': 'tossup', 'Long shot': 'longshot' } as const;

/**
 * Chance to land, in words. Interest alone isn't a chance: a recruit at 100
 * can still pick a rival at 100, so the board shows where the race stands.
 */
export function LandChip({ chance }: { chance: LandChance }) {
  const percent = Math.round(chance.probability * 100);
  return (
    <span
      className={`land-chip land-${SLUG[chance.label]}${chance.hypothetical ? ' land-hypothetical' : ''}`}
      title={`Chance to land: about ${percent}%. ${chance.detail}`}
    >
      {chance.hypothetical ? 'If offered: ' : ''}
      {chance.label}
    </span>
  );
}
