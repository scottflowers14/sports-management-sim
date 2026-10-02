import type { ID, Team } from './models';
import type { Recruit } from './recruiting';

export interface PositionNeed {
  position: string;
  /** Seniors and grad students who leave after this season. */
  graduating: number;
  /** Everyone else on the roster. */
  returning: number;
  /** Recruits committed or signed to this team. */
  committed: number;
  /** Open recruits holding this team's offer. */
  offersOut: number;
  /** Graduates not yet replaced by a commitment. */
  open: number;
}

/**
 * The roster outlook a recruiting coordinator works from: who's leaving, who's
 * coming, and how many spots are still unfilled, position by position.
 */
export function classNeedsByPosition<Position extends string, SportTraits>(
  team: Team<Position, SportTraits>,
  recruits: Recruit<Position, SportTraits>[],
  positions?: readonly Position[],
): PositionNeed[] {
  const needs = new Map<string, PositionNeed>();
  const entry = (position: string) => {
    let need = needs.get(position);
    if (!need) {
      need = { position, graduating: 0, returning: 0, committed: 0, offersOut: 0, open: 0 };
      needs.set(position, need);
    }
    return need;
  };
  for (const position of positions ?? []) entry(position);
  for (const player of team.roster) {
    const need = entry(player.position);
    if (player.classYear === 'SR' || player.classYear === 'GR') need.graduating += 1;
    else need.returning += 1;
  }
  for (const recruit of recruits) {
    if (isPledgedTo(recruit, team.id)) entry(recruit.position).committed += 1;
    else if (recruit.status === 'open' && recruit.scholarshipOffers.some((o) => o.teamId === team.id)) {
      entry(recruit.position).offersOut += 1;
    }
  }
  for (const need of needs.values()) need.open = Math.max(0, need.graduating - need.committed);
  return [...needs.values()];
}

function isPledgedTo<Position extends string, SportTraits>(recruit: Recruit<Position, SportTraits>, teamId: ID): boolean {
  return recruit.committedTeamId === teamId || recruit.signedTeamId === teamId;
}
