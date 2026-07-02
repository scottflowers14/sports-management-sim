/**
 * The user's in-flight recruiting actions for the current week. Pitches apply
 * immediately but are limited to one per recruit per week; visit invites are
 * queued and resolve during the weekly sim using the result of the game the
 * recruit attends. Both reset when the week is simulated.
 */
export interface RecruitingActivity {
  /** Recruits invited to this week's home game. */
  visitIds: string[];
  /** Recruits already pitched this week. */
  pitchedIds: string[];
}

export function emptyRecruitingActivity(): RecruitingActivity {
  return { visitIds: [], pitchedIds: [] };
}
