import type { LacrossePlayer } from '@sports-management-sim/sport-lacrosse';
import { careerTotals, type CareerStatsMap } from './career-stats';
import type { PlayerSeasonStats, SeasonStatsMap } from './stats';

export interface MilestoneStat {
  label: string;
  read: (s: PlayerSeasonStats) => number;
  marks: number[];
}

/** Round-number career marks worth a headline. */
export const CAREER_MILESTONES: MilestoneStat[] = [
  { label: 'career points', read: (s) => s.goals + s.assists, marks: [100, 150, 200, 250, 300] },
  { label: 'career goals', read: (s) => s.goals, marks: [50, 100, 150, 200] },
  { label: 'career assists', read: (s) => s.assists, marks: [50, 100, 150] },
  { label: 'career saves', read: (s) => s.saves, marks: [250, 500, 750, 1000] },
  { label: 'career ground balls', read: (s) => s.groundBalls, marks: [100, 200, 300, 400] },
  { label: 'career faceoff wins', read: (s) => s.faceoffWins, marks: [250, 500, 750, 1000] },
  { label: 'career caused turnovers', read: (s) => s.causedTurnovers, marks: [50, 100] },
];

export interface CareerMilestone {
  playerId: string;
  label: string;
  mark: number;
}

/**
 * Marks a player passed this week: his career total (past seasons plus the
 * live one) was under the mark before the week and at or over it after.
 * Only the highest mark per stat is reported if a week clears two.
 */
export function careerMilestonesForWeek(
  roster: readonly LacrossePlayer[],
  careers: CareerStatsMap,
  before: SeasonStatsMap,
  after: SeasonStatsMap,
): CareerMilestone[] {
  const milestones: CareerMilestone[] = [];
  for (const player of roster) {
    if (!after[player.id]) continue;
    const was = careerTotals(careers[player.id], before[player.id]);
    const now = careerTotals(careers[player.id], after[player.id]);
    for (const stat of CAREER_MILESTONES) {
      const from = stat.read(was);
      const to = stat.read(now);
      const passed = stat.marks.filter((m) => from < m && to >= m);
      if (passed.length > 0) milestones.push({ playerId: player.id, label: stat.label, mark: passed[passed.length - 1]! });
    }
  }
  return milestones;
}
