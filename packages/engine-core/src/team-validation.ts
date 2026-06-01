import type { Team } from './models';
import { failure, success, type Result } from './result';

export function validateTeamScholarships(team: Team): Result<Team> {
  if (team.resources.scholarshipUsed > team.resources.scholarshipLimit) {
    return failure(
      `Team ${team.id} exceeds scholarship limit: ${team.resources.scholarshipUsed}/${team.resources.scholarshipLimit}`,
    );
  }

  return success(team);
}
