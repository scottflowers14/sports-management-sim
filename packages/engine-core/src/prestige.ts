import type { StandingsEntry, Team } from './models';

/** Where program prestige settles without sustained winning or losing. */
export const PRESTIGE_CENTER = 65;
/** Share of the gap to the center a program closes each offseason. */
export const PRESTIGE_REVERSION = 0.06;

/** Above this, every gain is harder to come by and the pull back is stronger. */
export const PRESTIGE_ELITE = 85;
/** Extra share of the distance above PRESTIGE_ELITE lost each offseason. */
export const PRESTIGE_ELITE_REVERSION = 0.08;

/**
 * Share of a prestige gain a program keeps. Full below the elite line, then
 * shrinking toward a quarter at the cap: playtests saw the top program reach
 * 99 by year five in every long career and stay there.
 */
export function prestigeHeadroom(prestige: number): number {
  if (prestige < PRESTIGE_ELITE) return 1;
  return Math.max(0.25, (99 - prestige) / (99 - PRESTIGE_ELITE));
}

/** The yearly pull toward the middle; elite programs feel it more. */
export function prestigeDrift(prestige: number): number {
  const base = (PRESTIGE_CENTER - prestige) * PRESTIGE_REVERSION;
  return prestige > PRESTIGE_ELITE ? base - (prestige - PRESTIGE_ELITE) * PRESTIGE_ELITE_REVERSION : base;
}

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

    let gain = 0;
    if (team.id === nationalChampionId) {
      recentSuccess = Math.min(99, recentSuccess + 8);
      gain = 5;
    } else if (winPct > 0.75) {
      gain = 2;
    } else if (winPct > 0.6) {
      gain = 1;
    } else if (winPct < 0.2) {
      gain = -2;
    } else if (winPct < 0.35) {
      gain = -1;
    }
    nationalPrestige += gain > 0 ? Math.round(gain * prestigeHeadroom(nationalPrestige)) : gain;
    // Round the pull toward the middle symmetrically: Math.round sends -1.5 to
    // -1 but +1.5 to +2, which let bottom programs climb faster than blue bloods fell.
    const drift = prestigeDrift(team.reputation.nationalPrestige);
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
