import type { StandingsEntry, Team } from './models';

/** Where program prestige settles without sustained winning or losing. */
export const PRESTIGE_CENTER = 65;
/** Share of the gap to the center a program closes each offseason. */
export const PRESTIGE_REVERSION = 0.06;

/**
 * A season's results move each program's reputation. Winning builds national
 * prestige and losing erodes it, while a gentle pull toward the middle keeps
 * blue bloods from compounding forever and gives bottom programs a way back.
 */
export function evolveProgramPrestige<Position extends string, SportTraits>(
  teams: Team<Position, SportTraits>[],
  standings: StandingsEntry[],
  nationalChampionId?: string,
): Team<Position, SportTraits>[] {
  return teams.map((team) => {
    const standing = standings.find((s) => s.teamId === team.id);
    const wins = standing?.record.wins ?? 0;
    const losses = standing?.record.losses ?? 0;
    const total = wins + losses;
    const winPct = total > 0 ? wins / total : 0.5;
    const perfBase = Math.round(winPct * 100);

    // Drift recentSuccess toward season performance
    const gap = perfBase - team.reputation.recentSuccess;
    let recentSuccess = clamp(team.reputation.recentSuccess + Math.round(gap * 0.3), 40, 99);
    let nationalPrestige = team.reputation.nationalPrestige;

    if (team.id === nationalChampionId) {
      recentSuccess = Math.min(99, recentSuccess + 8);
      nationalPrestige += 5;
    } else if (winPct > 0.75) {
      nationalPrestige += 2;
    } else if (winPct > 0.6) {
      nationalPrestige += 1;
    } else if (winPct < 0.35) {
      nationalPrestige -= 1;
    }
    // Round the pull toward the middle symmetrically: Math.round sends -1.5 to
    // -1 but +1.5 to +2, which let bottom programs climb faster than blue bloods fell.
    const drift = (PRESTIGE_CENTER - team.reputation.nationalPrestige) * PRESTIGE_REVERSION;
    nationalPrestige += Math.sign(drift) * Math.round(Math.abs(drift));

    return {
      ...team,
      reputation: { ...team.reputation, recentSuccess, nationalPrestige: clamp(nationalPrestige, 40, 99) },
    };
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
