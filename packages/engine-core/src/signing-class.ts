import type { Player, SeasonYear, Team } from './models';
import type { Recruit } from './recruiting';

export function signCommittedRecruit<Position extends string, SportTraits>(
  recruit: Recruit<Position, SportTraits>,
): Recruit<Position, SportTraits> {
  if (recruit.status !== 'committed' || recruit.committedTeamId === undefined) {
    return recruit;
  }

  return {
    ...recruit,
    status: 'signed',
    signedTeamId: recruit.committedTeamId,
  };
}

export function addSignedRecruitsToTeam<Position extends string, SportTraits>(
  team: Team<Position, SportTraits>,
  recruits: Recruit<Position, SportTraits>[],
  seasonYear: SeasonYear,
): Team<Position, SportTraits> {
  const incomingPlayers = recruits
    .filter((recruit) => recruit.status === 'signed' && recruit.signedTeamId === team.id)
    .map((recruit) => recruitToPlayer(recruit, team.id, seasonYear));

  if (incomingPlayers.length === 0) {
    return team;
  }

  const addedScholarship = incomingPlayers.reduce((sum, player) => sum + player.scholarshipPercent / 100, 0);

  return {
    ...team,
    resources: {
      ...team.resources,
      scholarshipUsed: roundScholarships(team.resources.scholarshipUsed + addedScholarship),
    },
    roster: [...team.roster, ...incomingPlayers],
  };
}

function recruitToPlayer<Position extends string, SportTraits>(
  recruit: Recruit<Position, SportTraits>,
  teamId: string,
  seasonYear: SeasonYear,
): Player<Position, SportTraits> {
  const scholarshipPercent = recruit.scholarshipOffers.find((offer) => offer.teamId === teamId)?.scholarshipPercent ?? 0;

  return {
    id: `player-from-${recruit.id}`,
    name: recruit.name,
    age: recruit.age + 1,
    classYear: 'FR',
    hometown: recruit.hometown,
    regionId: recruit.regionId,
    position: recruit.position,
    secondaryPositions: [],
    ratings: recruit.ratings,
    traits: [],
    sportTraits: recruit.sportTraits as SportTraits,
    scholarshipPercent,
    isWalkOn: scholarshipPercent === 0,
    morale: 50,
    health: 100,
    fatigue: 0,
    redshirtStatus: 'redshirt_available',
    eligibility: {
      seasonsPlayed: 0,
      seasonsRemaining: 4,
      isEligible: true,
    },
    recruitingProfile: {
      starRating: recruit.starRating,
      interestLevel: recruit.interestByTeamId[teamId] ?? 0,
      academicFit: recruit.preferences.academicImportance,
      proximityPreference: recruit.preferences.proximityImportance,
      playingTimeImportance: recruit.preferences.playingTimeImportance,
      prestigeImportance: recruit.preferences.prestigeImportance,
      scholarshipImportance: recruit.preferences.scholarshipImportance,
      ...(recruit.committedTeamId !== undefined ? { committedTeamId: recruit.committedTeamId } : {}),
      ...(recruit.signedTeamId !== undefined ? { signedTeamId: recruit.signedTeamId } : {}),
    },
    createdSeason: seasonYear,
  };
}

function roundScholarships(value: number): number {
  return Math.round(value * 100) / 100;
}
