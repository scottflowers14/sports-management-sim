import type { ID, Team } from './models';
import { calculateRecruitFitScore, topRecruitMotivations, type Recruit, type RecruitMotivation, type RecruitPreferences } from './recruiting';

/**
 * Active recruiting actions: instead of interest accruing automatically after an
 * offer, coaches spend weekly recruiting hours on pitches and campus visits.
 * Pitches only pay off when they match what the recruit actually cares about,
 * which is exactly what scouting reveals.
 */

export type PitchResult = 'strong' | 'good' | 'lukewarm' | 'flat';

export interface PitchOutcome<Position extends string = string, SportTraits = unknown> {
  recruit: Recruit<Position, SportTraits>;
  result: PitchResult;
  interestChange: number;
}

const MOTIVATION_IMPORTANCE: Record<RecruitMotivation, keyof RecruitPreferences> = {
  proximity: 'proximityImportance',
  prestige: 'prestigeImportance',
  scholarship: 'scholarshipImportance',
  playingTime: 'playingTimeImportance',
  academics: 'academicImportance',
};

/**
 * Pitch a recruiting angle to a recruit. Selling something they care deeply about
 * lands hard; selling something they don't care about falls flat and costs a
 * little goodwill. Pitching a recruit committed elsewhere (a flip attempt) works
 * at reduced strength.
 */
export function applyRecruitPitch<Position extends string, SportTraits>(
  recruit: Recruit<Position, SportTraits>,
  teamId: ID,
  motivation: RecruitMotivation,
  interestMultiplier = 1,
): PitchOutcome<Position, SportTraits> {
  const importance = recruit.preferences[MOTIVATION_IMPORTANCE[motivation]];
  const isFlipAttempt = recruit.status !== 'open' && recruit.committedTeamId !== teamId;

  let result: PitchResult;
  let base: number;
  if (importance >= 75) {
    result = 'strong';
    base = 13;
  } else if (importance >= 60) {
    result = 'good';
    base = 9;
  } else if (importance >= 45) {
    result = 'lukewarm';
    base = 4;
  } else {
    result = 'flat';
    base = -3;
  }

  let interestChange = base > 0 ? Math.round(base * interestMultiplier) : base;
  if (isFlipAttempt && interestChange > 0) {
    interestChange = Math.round(interestChange * 0.5);
  }

  const current = recruit.interestByTeamId[teamId] ?? 0;

  return {
    recruit: {
      ...recruit,
      interestByTeamId: {
        ...recruit.interestByTeamId,
        [teamId]: clamp(current + interestChange, 0, 100),
      },
    },
    result,
    interestChange,
  };
}

export type VisitImpression = 'electric' | 'positive' | 'flat';

export interface VisitContext {
  /** Did the host team win the game the recruit attended? */
  won: boolean;
  /** National rank of the opponent at kickoff, if ranked. */
  opponentRank?: number | null;
  /** Host program's facilities rating (0-100). */
  facilities: number;
  /** Prestige-gap dampener, same convention as applyScholarshipOffer. */
  interestMultiplier?: number;
}

export interface VisitOutcome<Position extends string = string, SportTraits = unknown> {
  recruit: Recruit<Position, SportTraits>;
  impression: VisitImpression;
  interestChange: number;
}

/**
 * Host a recruit on a campus visit for a home game. The result of the game the
 * recruit watches drives the impression: a big win over a ranked opponent in
 * front of a recruit who craves the big stage is the best sales pitch there is.
 */
export function applyCampusVisit<Position extends string, SportTraits>(
  recruit: Recruit<Position, SportTraits>,
  teamId: ID,
  context: VisitContext,
): VisitOutcome<Position, SportTraits> {
  const { won, opponentRank = null, facilities, interestMultiplier = 1 } = context;

  let boost = 7;
  boost += won ? 7 : 1;
  if (opponentRank !== null && opponentRank <= 10) {
    boost += won ? 6 : 2;
  } else if (opponentRank !== null && opponentRank <= 20) {
    boost += won ? 3 : 1;
  }
  boost += Math.round((facilities - 50) / 10);

  const topMotivations = topRecruitMotivations(recruit.preferences, 2);
  if (topMotivations.includes('prestige') && won && opponentRank !== null) {
    boost += 4;
  }

  const interestChange = Math.max(1, Math.round(boost * interestMultiplier));
  const impression: VisitImpression = interestChange >= 18 ? 'electric' : interestChange >= 10 ? 'positive' : 'flat';
  const current = recruit.interestByTeamId[teamId] ?? 0;

  return {
    recruit: {
      ...recruit,
      interestByTeamId: {
        ...recruit.interestByTeamId,
        [teamId]: clamp(current + interestChange, 0, 100),
      },
    },
    impression,
    interestChange,
  };
}

/** How many weeks before their decision a recruit publicly narrows to finalists. */
export const FINALIST_ANNOUNCE_LEAD = 3;

/**
 * The week a recruit announces their commitment, deterministic per recruit so it
 * can be derived anywhere without storage. Higher-star recruits enjoy the
 * spotlight and decide later; some blue-chips stretch past the regular season to
 * signing day.
 */
export function recruitDecisionWeek(recruitId: ID, starRating: number, finalWeek: number): number {
  const earliest = Math.round(finalWeek * (0.3 + starRating * 0.09));
  const spread = hashId(recruitId) % 4;
  return clamp(earliest + spread, 3, finalWeek + 2);
}

/** Offer-holding teams ranked by the recruit's interest — their public finalists. */
export function finalistTeamIds<Position extends string, SportTraits>(
  recruit: Recruit<Position, SportTraits>,
  count = 3,
): ID[] {
  return [...recruit.scholarshipOffers]
    .map((offer) => ({ teamId: offer.teamId, interest: recruit.interestByTeamId[offer.teamId] ?? 0 }))
    .sort((a, b) => b.interest - a.interest || a.teamId.localeCompare(b.teamId))
    .slice(0, count)
    .map((entry) => entry.teamId);
}

export function isFinalistPhase(currentWeek: number, decisionWeek: number): boolean {
  return currentWeek >= decisionWeek - FINALIST_ANNOUNCE_LEAD && currentWeek < decisionWeek;
}

/**
 * Pick the team an open recruit commits to. Interest dominates, program fit and
 * scholarship money matter at the margin, and a little noise keeps neck-and-neck
 * races from being foregone conclusions.
 */
export function chooseCommitTeam<Position extends string, SportTraits>(
  recruit: Recruit<Position, SportTraits>,
  teams: Team<Position, SportTraits>[],
  random: () => number,
): ID | undefined {
  let best: { teamId: ID; score: number } | undefined;

  for (const offer of recruit.scholarshipOffers) {
    const team = teams.find((t) => t.id === offer.teamId);
    if (!team) continue;
    const interest = recruit.interestByTeamId[offer.teamId] ?? 0;
    const score =
      interest + calculateRecruitFitScore(recruit, team) * 0.2 + offer.scholarshipPercent * 0.08 + random() * 8;
    if (!best || score > best.score) {
      best = { teamId: offer.teamId, score };
    }
  }

  return best?.teamId;
}

/**
 * A committed (unsigned) recruit can be talked into reopening their recruitment
 * when a rival program's interest has clearly overtaken their current school's.
 * The bigger the gap, the more likely the flip.
 */
export function shouldReopenCommitment<Position extends string, SportTraits>(
  recruit: Recruit<Position, SportTraits>,
  random: () => number,
): boolean {
  if (recruit.status !== 'committed' || recruit.committedTeamId === undefined) return false;

  const committedInterest = recruit.interestByTeamId[recruit.committedTeamId] ?? 0;
  const rivalInterest = Math.max(
    0,
    ...Object.entries(recruit.interestByTeamId)
      .filter(([teamId]) => teamId !== recruit.committedTeamId)
      .map(([, interest]) => interest),
  );

  const gap = rivalInterest - committedInterest;
  if (gap < 8) return false;

  const chance = Math.min(0.35, 0.12 + gap * 0.01);
  return random() < chance;
}

function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
