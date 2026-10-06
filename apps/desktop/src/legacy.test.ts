import { describe, expect, it } from 'vitest';
import { LEGACY_TIERS, legacyScore, legacyTier, nextLegacyTier } from './legacy';

describe('coach legacy', () => {
  it('weights titles over conference crowns over wins', () => {
    const base = { wins: 80, losses: 40, confTitles: 3, nationalTitles: 1 };
    // 80 wins + 36 conf + 50 title + half the 40-game margin.
    expect(legacyScore(base)).toBe(186);
    expect(legacyScore({ ...base, nationalTitles: 2 }) - legacyScore(base)).toBe(50);
    expect(legacyScore({ ...base, confTitles: 4 }) - legacyScore(base)).toBe(12);
    // A losing record earns no margin bonus, and never goes negative.
    expect(legacyScore({ wins: 20, losses: 60, confTitles: 0, nationalTitles: 0 })).toBe(20);
  });

  it('names a tier for every score and points at the next one', () => {
    expect(legacyTier(0)).toBe('Up-and-Comer');
    expect(legacyTier(186)).toBe('Established');
    expect(legacyTier(450)).toBe('Hall of Fame');
    expect(legacyTier(5000)).toBe('Legend');
    expect(nextLegacyTier(186)).toEqual({ min: 250, label: 'Elite' });
    expect(nextLegacyTier(800)).toBeNull();
    // Tiers run from the top down, so the lookup finds the highest one reached.
    expect(LEGACY_TIERS.map((t) => t.min)).toEqual([...LEGACY_TIERS.map((t) => t.min)].sort((a, b) => b - a));
  });
});
