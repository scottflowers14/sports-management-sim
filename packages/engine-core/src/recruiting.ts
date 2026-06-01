import type { ID, PersonName, PlayerRatings, Rating, RegionId, Team } from './models';

export type RecruitStatus = 'open' | 'committed' | 'signed';

export interface RecruitPreferences {
  proximityImportance: Rating;
  prestigeImportance: Rating;
  scholarshipImportance: Rating;
  playingTimeImportance: Rating;
  academicImportance: Rating;
}

export interface ScholarshipOffer {
  teamId: ID;
  scholarshipPercent: number;
}

export interface Recruit<Position extends string = string, SportTraits = unknown> {
  id: ID;
  name: PersonName;
  age: number;
  hometown: string;
  regionId: RegionId;
  position: Position;
  starRating: 1 | 2 | 3 | 4 | 5;
  ratings: PlayerRatings;
  sportTraits?: SportTraits;
  preferences: RecruitPreferences;
  interestByTeamId: Record<ID, Rating>;
  scholarshipOffers: ScholarshipOffer[];
  committedTeamId?: ID;
  signedTeamId?: ID;
  status: RecruitStatus;
}

export function calculateRecruitFitScore<Position extends string, SportTraits>(
  recruit: Recruit<Position, SportTraits>,
  team: Team<Position, SportTraits>,
): Rating {
  const prestigeScore = average([
    team.reputation.nationalPrestige,
    team.reputation.coachingPrestige,
    team.reputation.facilities,
    team.reputation.recentSuccess,
  ]);
  const academicScore = team.reputation.academicPrestige;
  const proximityScore = recruit.regionId === team.regionId ? 100 : 25;
  const scholarshipRoom = Math.max(0, team.resources.scholarshipLimit - team.resources.scholarshipUsed);
  const scholarshipScore = clamp(scholarshipRoom * 100, 0, 100);
  const playingTimeScore = clamp(100 - team.roster.length * 2, 10, 100);

  const weightedTotal =
    proximityScore * recruit.preferences.proximityImportance +
    prestigeScore * recruit.preferences.prestigeImportance +
    scholarshipScore * recruit.preferences.scholarshipImportance +
    playingTimeScore * recruit.preferences.playingTimeImportance +
    academicScore * recruit.preferences.academicImportance;

  const totalWeight =
    recruit.preferences.proximityImportance +
    recruit.preferences.prestigeImportance +
    recruit.preferences.scholarshipImportance +
    recruit.preferences.playingTimeImportance +
    recruit.preferences.academicImportance;

  return Math.round(weightedTotal / totalWeight);
}

export function applyScholarshipOffer<Position extends string, SportTraits>(
  recruit: Recruit<Position, SportTraits>,
  teamId: ID,
  scholarshipPercent: number,
): Recruit<Position, SportTraits> {
  const clampedScholarshipPercent = clamp(scholarshipPercent, 0, 100);
  const existingOfferIndex = recruit.scholarshipOffers.findIndex((offer) => offer.teamId === teamId);
  const scholarshipOffers = [...recruit.scholarshipOffers];

  if (existingOfferIndex >= 0) {
    scholarshipOffers[existingOfferIndex] = { teamId, scholarshipPercent: clampedScholarshipPercent };
  } else {
    scholarshipOffers.push({ teamId, scholarshipPercent: clampedScholarshipPercent });
  }

  const currentInterest = recruit.interestByTeamId[teamId] ?? 0;
  const interestBoost = Math.round(clampedScholarshipPercent * (recruit.preferences.scholarshipImportance / 100) * 0.35);

  return {
    ...recruit,
    scholarshipOffers,
    interestByTeamId: {
      ...recruit.interestByTeamId,
      [teamId]: clamp(currentInterest + interestBoost, 0, 100),
    },
  };
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
