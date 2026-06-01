import type { ID, Rating, Team } from './models';
import { calculateRecruitFitScore, type Recruit } from './recruiting';

export interface RecruitCandidateRanking<Position extends string = string, SportTraits = unknown> {
  team: Team<Position, SportTraits>;
  score: Rating;
  interest: Rating;
  fitScore: Rating;
  scholarshipPercent: number;
}

export function rankRecruitCandidates<Position extends string, SportTraits>(
  recruit: Recruit<Position, SportTraits>,
  teams: Team<Position, SportTraits>[],
): RecruitCandidateRanking<Position, SportTraits>[] {
  return teams
    .map((team) => {
      const interest = recruit.interestByTeamId[team.id] ?? 0;
      const fitScore = calculateRecruitFitScore(recruit, team);
      const scholarshipPercent = scholarshipOfferForTeam(recruit, team.id);
      const score = Math.round(interest * 0.65 + fitScore * 0.25 + scholarshipPercent * 0.1);

      return {
        team,
        score,
        interest,
        fitScore,
        scholarshipPercent,
      };
    })
    .sort((a, b) => b.score - a.score || b.scholarshipPercent - a.scholarshipPercent || a.team.id.localeCompare(b.team.id));
}

export function commitRecruit<Position extends string, SportTraits>(
  recruit: Recruit<Position, SportTraits>,
  teams: Team<Position, SportTraits>[],
): Recruit<Position, SportTraits> {
  if (recruit.status !== 'open') {
    return recruit;
  }

  const topCandidate = rankRecruitCandidates(recruit, teams)[0];

  if (topCandidate === undefined) {
    return recruit;
  }

  return {
    ...recruit,
    status: 'committed',
    committedTeamId: topCandidate.team.id,
  };
}

function scholarshipOfferForTeam<Position extends string, SportTraits>(
  recruit: Recruit<Position, SportTraits>,
  teamId: ID,
): number {
  return recruit.scholarshipOffers.find((offer) => offer.teamId === teamId)?.scholarshipPercent ?? 0;
}
