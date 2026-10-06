import {
  ACHIEVEMENT_BY_ID,
  TIER_POINTS,
  type AchievementDef,
  type UnlockedAchievements,
} from "./achievements";
import type { ChallengeResult } from "./challenges";

/** What a finished season added to the coach profile, for the offseason recap. */
export interface SeasonReport {
  year: number;
  achievements: AchievementDef[];
  points: number;
  challengesMet: number;
  challengesFaced: number;
  challengeXp: number;
}

export function seasonReport(
  year: number,
  achievements: UnlockedAchievements,
  challengeLog: readonly ChallengeResult[],
): SeasonReport {
  const earned = Object.entries(achievements)
    .filter(([, unlock]) => unlock.year === year)
    .map(([id]) => ACHIEVEMENT_BY_ID.get(id))
    .filter((def): def is AchievementDef => def !== undefined)
    // Biggest first: platinum before bronze.
    .sort(
      (a, b) =>
        TIER_POINTS[b.tier] - TIER_POINTS[a.tier] ||
        a.title.localeCompare(b.title),
    );
  const challenges = challengeLog.filter((c) => c.year === year);
  const met = challenges.filter((c) => c.completed);
  return {
    year,
    achievements: earned,
    points: earned.reduce((n, def) => n + TIER_POINTS[def.tier], 0),
    challengesMet: met.length,
    challengesFaced: challenges.length,
    challengeXp: met.reduce((n, c) => n + c.xp, 0),
  };
}
