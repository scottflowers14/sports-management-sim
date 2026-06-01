import type { Player, PlayerClass, Team, TeamRecord } from './models';

export interface RunTeamOffseasonOptions {
  developmentRandom?: () => number;
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
  const gain = Math.min(potentialGap, Math.max(0, Math.round((1 + developmentRoll * 3) * workEthicMultiplier)));
  const nextOverall = Math.min(player.ratings.potential, player.ratings.overall + gain);

  return {
    ...player,
    ratings: {
      ...player.ratings,
      overall: nextOverall,
      athleticism: progressRating(player.ratings.athleticism, player.ratings.potential, gain),
      speed: progressRating(player.ratings.speed, player.ratings.potential, gain),
      strength: progressRating(player.ratings.strength, player.ratings.potential, gain),
      stamina: progressRating(player.ratings.stamina, player.ratings.potential, gain),
      skill: progressRating(player.ratings.skill, player.ratings.potential, gain),
      iq: progressRating(player.ratings.iq, player.ratings.potential, gain),
    },
  };
}

export function runTeamOffseason<Position extends string, SportTraits>(
  team: Team<Position, SportTraits>,
  options: RunTeamOffseasonOptions = {},
): Team<Position, SportTraits> {
  const developmentRandom = options.developmentRandom ?? Math.random;
  const returningPlayers = team.roster.flatMap((player) => {
    const nextClass = advancePlayerClass(player.classYear);

    if (nextClass === null) {
      return [];
    }

    const progressed = progressPlayer(player, developmentRandom());

    return [
      {
        ...progressed,
        age: progressed.age + 1,
        classYear: nextClass,
        fatigue: 0,
        eligibility: {
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

function progressRating(current: number, potential: number, gain: number): number {
  return Math.min(potential, current + Math.max(0, Math.floor(gain / 2)));
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
