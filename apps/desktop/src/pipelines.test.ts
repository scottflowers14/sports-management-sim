import { describe, expect, it } from 'vitest';
import type { LacrosseTeam } from '@sports-management-sim/sport-lacrosse';
import { recruitingPipelines } from './pipelines';

const regions = [
  { id: 'long-island', name: 'Long Island' },
  { id: 'new-england', name: 'New England' },
  { id: 'west', name: 'West' },
];

function team(regionCounts: Record<string, number>): LacrosseTeam {
  const roster = Object.entries(regionCounts).flatMap(([regionId, n]) =>
    Array.from({ length: n }, (_, i) => ({ id: `${regionId}-${i}`, regionId, isWalkOn: false, recruitingProfile: { starRating: 3 } })),
  );
  return { id: 'us', regionId: 'mid-atlantic', roster } as unknown as LacrosseTeam;
}

describe('recruitingPipelines', () => {
  it('lists pipelines strongest first and the ones a signee away', () => {
    const rows = recruitingPipelines(team({ 'long-island': 6, 'new-england': 1, west: 3, 'mid-atlantic': 9 }), regions);
    expect(rows).toEqual([
      { regionId: 'long-island', name: 'Long Island', count: 6, tier: 2, toNext: 2 },
      { regionId: 'west', name: 'West', count: 3, tier: 1, toNext: 2 },
      { regionId: 'new-england', name: 'New England', count: 1, tier: 0, toNext: 1 },
    ]);
  });
});
