import { describe, expect, it } from 'vitest';
import { generateLacrosseRecruitingClass } from './recruit-generation';

describe('generateLacrosseRecruitingClass', () => {
  it('generates the requested number of lacrosse recruits', () => {
    const recruits = generateLacrosseRecruitingClass({ count: 20, seed: 123 });

    expect(recruits).toHaveLength(20);
    expect(recruits.every((recruit) => recruit.id.startsWith('lacrosse-recruit-'))).toBe(true);
  });

  it('weights recruits toward lacrosse hotbed regions', () => {
    const recruits = generateLacrosseRecruitingClass({ count: 100, seed: 123 });
    const hotbedRegions = new Set(['mid-atlantic', 'long-island', 'upstate-ny', 'new-england', 'colorado']);
    const hotbedCount = recruits.filter((recruit) => hotbedRegions.has(recruit.regionId)).length;

    expect(hotbedCount).toBeGreaterThanOrEqual(70);
  });

  it('includes lacrosse-specific positions including GK and FOGO', () => {
    const recruits = generateLacrosseRecruitingClass({ count: 60, seed: 99 });
    const positions = new Set(recruits.map((recruit) => recruit.position));

    expect(positions.has('GK')).toBe(true);
    expect(positions.has('FOGO')).toBe(true);
    expect(positions.has('ATT')).toBe(true);
    expect(positions.has('MID')).toBe(true);
    expect(positions.has('DEF')).toBe(true);
    expect(positions.has('LSM')).toBe(true);
  });

  it('generates identical classes for identical seeds', () => {
    expect(generateLacrosseRecruitingClass({ count: 10, seed: 42 })).toEqual(
      generateLacrosseRecruitingClass({ count: 10, seed: 42 }),
    );
  });
});
