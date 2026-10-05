import { PIPELINE_TIER_THRESHOLDS, pipelineCounts, pipelineTierFor } from '@sports-management-sim/engine-core';
import type { LacrosseTeam } from '@sports-management-sim/sport-lacrosse';

export interface PipelineRow {
  regionId: string;
  name: string;
  count: number;
  tier: number;
  /** Signees still needed for the next tier, or null at the top. */
  toNext: number | null;
}

/** The user's pipelines, strongest first, including regions one signee from a first tier. */
export function recruitingPipelines(team: LacrosseTeam, regions: ReadonlyArray<{ id: string; name: string }>): PipelineRow[] {
  const counts = pipelineCounts(team);
  return [...counts.entries()]
    .map(([regionId, count]) => {
      const tier = pipelineTierFor(count);
      const next = PIPELINE_TIER_THRESHOLDS[tier];
      return {
        regionId,
        name: regions.find((r) => r.id === regionId)?.name ?? regionId,
        count,
        tier,
        toNext: next === undefined ? null : next - count,
      };
    })
    .filter((row) => row.tier > 0 || row.toNext === 1)
    .sort((a, b) => b.tier - a.tier || b.count - a.count);
}
