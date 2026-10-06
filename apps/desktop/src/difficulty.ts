import type { LacrosseDifficulty } from '@sports-management-sim/sport-lacrosse';

/**
 * Difficulty is set when a dynasty starts. It changes how hard CPU staffs
 * recruit against you and how much patience the athletic director has after
 * a bad year; games themselves are simulated the same way at every level.
 */
export type Difficulty = LacrosseDifficulty;

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };

export const DIFFICULTY_DESCRIPTIONS: Record<Difficulty, string> = {
  easy: 'CPU staffs recruit softer and your AD forgives more of a bad season.',
  normal: 'The standard game.',
  hard: 'CPU staffs recruit harder and your AD has less patience.',
};

/** Scales CPU programs' weekly interest gains with recruits. */
export function cpuRecruitingScale(difficulty: Difficulty | undefined): number {
  return difficulty === 'easy' ? 0.85 : difficulty === 'hard' ? 1.15 : 1;
}

/** Scales the AD's confidence losses after a season (gains are untouched). */
export function adPenaltyScale(difficulty: Difficulty | undefined): number {
  return difficulty === 'easy' ? 0.7 : difficulty === 'hard' ? 1.3 : 1;
}
