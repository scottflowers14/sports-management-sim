import type { Conference } from '@sports-management-sim/engine-core';

/** Which teams a stat leaderboard covers. */
export type StatScope = 'national' | 'conference' | 'team';

export const STAT_SCOPES: readonly StatScope[] = ['national', 'conference', 'team'];

export interface ScopeTeams {
  /** Team ids in scope; null means every team. */
  teamIds: ReadonlySet<string> | null;
  /** How the scope reads in a heading, e.g. "National", "Big East", "Your team". */
  label: string;
}

/**
 * The teams a leaderboard should include. Conference scope falls back to the
 * whole country when the user's team has no conference.
 */
export function scopeTeams(scope: StatScope, userTeamId: string, conferences: readonly Conference[]): ScopeTeams {
  if (scope === 'team') return { teamIds: new Set([userTeamId]), label: 'Your team' };
  if (scope === 'conference') {
    const conference = conferences.find((c) => c.teamIds.includes(userTeamId));
    if (conference) return { teamIds: new Set(conference.teamIds), label: conference.shortName };
  }
  return { teamIds: null, label: 'National' };
}

export function inScope(scope: ScopeTeams, teamId: string | undefined): boolean {
  return scope.teamIds === null || (teamId !== undefined && scope.teamIds.has(teamId));
}
