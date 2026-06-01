import { failure, success, type Result } from '@sports-management-sim/engine-core';
import type { LacrosseTeam } from './models';

export const D1_LACROSSE_MAX_ROSTER_SIZE = 45;
export const D1_LACROSSE_SCHOLARSHIP_LIMIT = 12.6;

export function validateLacrosseRoster(team: LacrosseTeam): Result<LacrosseTeam, string[]> {
  const errors: string[] = [];

  if (team.roster.length > D1_LACROSSE_MAX_ROSTER_SIZE) {
    errors.push(`Team ${team.id} has ${team.roster.length} players; maximum is ${D1_LACROSSE_MAX_ROSTER_SIZE}`);
  }

  if (!team.roster.some((player) => player.position === 'GK')) {
    errors.push(`Team ${team.id} must roster at least one GK`);
  }

  if (!team.roster.some((player) => player.position === 'FOGO')) {
    errors.push(`Team ${team.id} must roster at least one FOGO`);
  }

  if (team.resources.scholarshipUsed > D1_LACROSSE_SCHOLARSHIP_LIMIT) {
    errors.push(
      `Team ${team.id} exceeds D1 lacrosse scholarship cap: ${team.resources.scholarshipUsed}/${D1_LACROSSE_SCHOLARSHIP_LIMIT}`,
    );
  }

  if (errors.length > 0) {
    return failure<string[]>(errors);
  }

  return success<LacrosseTeam, string[]>(team);
}
