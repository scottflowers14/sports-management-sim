import type { Team } from './models';
import { calculateRecruitFitScore, type Recruit } from './recruiting';

export type RosterTargets<Position extends string> = Partial<Record<Position, number>>;

export interface RosterNeed<Position extends string = string> {
  position: Position;
  current: number;
  target: number;
  need: number;
}

export interface RecruitBoardEntry<Position extends string = string, SportTraits = unknown> {
  recruit: Recruit<Position, SportTraits>;
  score: number;
  fitScore: number;
  needScore: number;
  qualityScore: number;
  interestScore: number;
}

export function analyzeRosterNeeds<Position extends string, SportTraits>(
  team: Team<Position, SportTraits>,
  targets: RosterTargets<Position>,
): RosterNeed<Position>[] {
  return Object.entries(targets).map(([position, target]) => {
    const typedPosition = position as Position;
    const current = team.roster.filter((player) => player.position === typedPosition).length;
    const numericTarget = target as number;

    return {
      position: typedPosition,
      current,
      target: numericTarget,
      need: Math.max(0, numericTarget - current),
    };
  });
}

export function sortRecruitBoardForTeam<Position extends string, SportTraits>(
  team: Team<Position, SportTraits>,
  recruits: Recruit<Position, SportTraits>[],
  targets: RosterTargets<Position>,
): RecruitBoardEntry<Position, SportTraits>[] {
  const needsByPosition = new Map(
    analyzeRosterNeeds(team, targets).map((need) => [need.position, need]),
  );

  return recruits
    .map((recruit) => {
      const fitScore = calculateRecruitFitScore(recruit, team);
      const rosterNeed = needsByPosition.get(recruit.position);
      const needCount = Number(rosterNeed?.need ?? 0);
      const absenceBonus = rosterNeed !== undefined && rosterNeed.current === 0 ? 50 : 0;
      const needScore = needCount * 35 + absenceBonus;
      const qualityScore = Math.round(recruit.ratings.overall * 0.45 + recruit.ratings.potential * 0.55);
      const interestScore = recruit.interestByTeamId[team.id] ?? 0;
      const score = Math.round(fitScore * 0.25 + needScore * 0.35 + qualityScore * 0.25 + interestScore * 0.15);

      return {
        recruit,
        score,
        fitScore,
        needScore,
        qualityScore,
        interestScore,
      };
    })
    .sort((a, b) => b.score - a.score || b.needScore - a.needScore || b.qualityScore - a.qualityScore || a.recruit.id.localeCompare(b.recruit.id));
}
