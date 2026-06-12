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
  interestMultiplier = 1,
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
  const interestBoost = Math.round(
    clampedScholarshipPercent * (recruit.preferences.scholarshipImportance / 100) * 0.35 * interestMultiplier,
  );

  return {
    ...recruit,
    scholarshipOffers,
    interestByTeamId: {
      ...recruit.interestByTeamId,
      [teamId]: clamp(currentInterest + interestBoost, 0, 100),
    },
  };
}

/**
 * Elite recruits expect to play for elite programs. Interest gains shrink as the gap
 * between a recruit's expectations (set by star level) and a program's national
 * prestige grows; programs at or above expectations get a small bonus instead.
 */
export function recruitPrestigeMultiplier(starRating: number, nationalPrestige: number): number {
  const expectedPrestige = 25 + starRating * 13;
  const gap = expectedPrestige - nationalPrestige;
  if (gap <= 0) return 1.1;
  return clamp(1 - gap / 60, 0.2, 1);
}

/**
 * Scholarship-equivalency budget a team has tied up in its current recruiting class.
 * Offers to recruits who committed or signed elsewhere no longer count: that money
 * is released back into the pool.
 */
export function classScholarshipBudgetUsed<Position extends string, SportTraits>(
  recruits: Recruit<Position, SportTraits>[],
  teamId: ID,
): number {
  let used = 0;

  for (const recruit of recruits) {
    const offer = recruit.scholarshipOffers.find((candidate) => candidate.teamId === teamId);
    if (offer === undefined) continue;
    const lostToRival =
      recruit.status !== 'open' && recruit.committedTeamId !== teamId && recruit.signedTeamId !== teamId;
    if (lostToRival) continue;
    used += offer.scholarshipPercent / 100;
  }

  return Math.round(used * 100) / 100;
}

export type RecruitMotivation = 'proximity' | 'prestige' | 'scholarship' | 'playingTime' | 'academics';

/** A recruit's strongest motivations, ordered by how much they care. */
export function topRecruitMotivations(preferences: RecruitPreferences, count = 2): RecruitMotivation[] {
  const ranked: Array<[RecruitMotivation, number]> = [
    ['proximity', preferences.proximityImportance],
    ['prestige', preferences.prestigeImportance],
    ['scholarship', preferences.scholarshipImportance],
    ['playingTime', preferences.playingTimeImportance],
    ['academics', preferences.academicImportance],
  ];

  return ranked
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([motivation]) => motivation);
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
