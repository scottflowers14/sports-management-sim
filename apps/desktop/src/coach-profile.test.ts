import { describe, expect, it } from 'vitest';
import { generateJobOffers, shouldFireCoach } from './coach-profile';

describe('shouldFireCoach', () => {
  it('fires an established coach once confidence drops below 20', () => {
    expect(shouldFireCoach(19, 3)).toBe(true);
    expect(shouldFireCoach(19, 6)).toBe(true);
    expect(shouldFireCoach(20, 3)).toBe(false);
  });

  it('protects early-tenure coaches unless confidence totally collapses', () => {
    expect(shouldFireCoach(19, 1)).toBe(false);
    expect(shouldFireCoach(10, 2)).toBe(false);
    expect(shouldFireCoach(5, 0)).toBe(true);
    expect(shouldFireCoach(0, 1)).toBe(true);
  });
});

describe('generateJobOffers', () => {
  const makeTeam = (id: string, prestige: number) => ({
    id,
    name: `Team ${id}`,
    reputation: { nationalPrestige: prestige },
  });

  const teams = [
    makeTeam('a', 90),
    makeTeam('b', 80),
    makeTeam('c', 70),
    makeTeam('d', 60),
    makeTeam('e', 55),
    makeTeam('f', 50),
    makeTeam('g', 45),
    makeTeam('h', 42),
  ];

  it('offers up to three jobs, never from the fired team', () => {
    const offers = generateJobOffers(teams, 'a', 12345);
    expect(offers).toHaveLength(3);
    expect(offers.every((o) => o.teamId !== 'a')).toBe(true);
    expect(new Set(offers.map((o) => o.teamId)).size).toBe(3);
  });

  it('only offers jobs at lower-prestige programs', () => {
    const offers = generateJobOffers(teams, 'a', 999);
    // Bottom half of remaining teams: prestige 55 and below (e, f, g, h)
    expect(offers.every((o) => o.prestige <= 60)).toBe(true);
  });

  it('is deterministic for a given seed', () => {
    expect(generateJobOffers(teams, 'a', 7)).toEqual(generateJobOffers(teams, 'a', 7));
  });

  it('handles tiny leagues without crashing', () => {
    const offers = generateJobOffers([makeTeam('a', 60), makeTeam('b', 50)], 'a', 1);
    expect(offers).toHaveLength(1);
    expect(offers[0]!.teamId).toBe('b');
  });
});
