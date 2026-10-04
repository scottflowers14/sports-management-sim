import type { Player, PlayerClass, Team, TeamRecord } from './models';
import { REDSHIRT_DEVELOPMENT_BONUS } from './redshirt';

export interface RunTeamOffseasonOptions<Position extends string = string, SportTraits = unknown> {
  developmentRandom?: () => number;
  /** Extra development roll (0–1 scale) added per player, e.g. from a training focus. */
  developmentBonusFor?: (player: Player<Position, SportTraits>) => number;
  /** The season that just ended; when set, each returning player's rating history records it. */
  completedSeason?: number;
}

export function advancePlayerClass(classYear: PlayerClass): PlayerClass | null {
  switch (classYear) {
    case 'FR':
      return 'SO';
    case 'SO':
      return 'JR';
    case 'JR':
      return 'SR';
    case 'SR':
    case 'GR':
      return null;
  }
}

export function progressPlayer<Position extends string, SportTraits>(
  player: Player<Position, SportTraits>,
  developmentRoll = 0.5,
): Player<Position, SportTraits> {
  const potentialGap = Math.max(0, player.ratings.potential - player.ratings.overall);
  const workEthicMultiplier = 0.5 + player.ratings.workEthic / 100;

  let delta: number;
  if (potentialGap === 0) {
    // At ceiling: regression chance inversely scaled by work ethic
    // workEthic 100 → ~10% chance, workEthic 0 → ~40% chance
    const regressionThreshold = 0.4 - player.ratings.workEthic * 0.003;
    delta = developmentRoll < regressionThreshold ? -1 : 0;
  } else {
    delta = Math.min(potentialGap, Math.max(0, Math.round((1 + developmentRoll * 3) * workEthicMultiplier)));
  }

  const nextOverall = Math.min(player.ratings.potential, Math.max(1, player.ratings.overall + delta));

  return {
    ...player,
    ratings: {
      ...player.ratings,
      overall: nextOverall,
      athleticism: shiftRating(player.ratings.athleticism, player.ratings.potential, delta),
      speed: shiftRating(player.ratings.speed, player.ratings.potential, delta),
      strength: shiftRating(player.ratings.strength, player.ratings.potential, delta),
      stamina: shiftRating(player.ratings.stamina, player.ratings.potential, delta),
      skill: shiftRating(player.ratings.skill, player.ratings.potential, delta),
      iq: shiftRating(player.ratings.iq, player.ratings.potential, delta),
    },
  };
}

export function runTeamOffseason<Position extends string, SportTraits>(
  team: Team<Position, SportTraits>,
  options: RunTeamOffseasonOptions<Position, SportTraits> = {},
): Team<Position, SportTraits> {
  const developmentRandom = options.developmentRandom ?? Math.random;
  const returningPlayers = team.roster.flatMap((player) => {
    // A redshirt year doesn't count: he keeps his class and his eligibility,
    // and the year of practice without games pays off in development.
    const redshirted = player.redshirtStatus === 'redshirting';
    const nextClass = redshirted ? player.classYear : advancePlayerClass(player.classYear);

    if (nextClass === null) {
      return [];
    }

    const bonus = (options.developmentBonusFor?.(player) ?? 0) + (redshirted ? REDSHIRT_DEVELOPMENT_BONUS : 0);
    const roll = Math.min(1, Math.max(0, developmentRandom() + bonus));
    const progressed = progressPlayer(player, roll);
    // One entry per season: a repeated rollover for the same year replaces it.
    const ratingHistory =
      options.completedSeason === undefined
        ? player.ratingHistory
        : [
            ...(player.ratingHistory ?? []).filter((entry) => entry.season !== options.completedSeason),
            { season: options.completedSeason, classYear: player.classYear, overall: player.ratings.overall },
          ];

    return [
      {
        ...progressed,
        age: progressed.age + 1,
        classYear: nextClass,
        fatigue: 0,
        ...(ratingHistory ? { ratingHistory } : {}),
        ...(redshirted ? { redshirtStatus: 'redshirt_used' as const } : {}),
        eligibility: redshirted
          ? progressed.eligibility
          : {
              ...progressed.eligibility,
              seasonsPlayed: progressed.eligibility.seasonsPlayed + 1,
              seasonsRemaining: Math.max(0, progressed.eligibility.seasonsRemaining - 1),
              isEligible: progressed.eligibility.seasonsRemaining - 1 > 0,
            },
      },
    ];
  });

  return {
    ...team,
    roster: returningPlayers,
    resources: {
      ...team.resources,
      scholarshipUsed: roundScholarships(
        returningPlayers.reduce((sum, player) => sum + player.scholarshipPercent / 100, 0),
      ),
    },
    record: emptyRecord(),
  };
}

function shiftRating(current: number, potential: number, delta: number): number {
  if (delta >= 0) {
    return Math.min(Math.max(potential, current), current + Math.max(0, delta));
  }
  return Math.max(1, current + delta);
}

function emptyRecord(): TeamRecord {
  return {
    wins: 0,
    losses: 0,
    conferenceWins: 0,
    conferenceLosses: 0,
    homeWins: 0,
    homeLosses: 0,
    awayWins: 0,
    awayLosses: 0,
    neutralWins: 0,
    neutralLosses: 0,
  };
}

function roundScholarships(value: number): number {
  return Math.round(value * 100) / 100;
}
