import {
  calculateRecruitFitScore,
  FINALIST_ANNOUNCE_LEAD,
  recruitDecisionWeek,
  recruitPrestigeMultiplier,
  suggestedScholarshipPercent,
} from '@sports-management-sim/engine-core';
import type { LacrosseRecruit, LacrosseTeam } from '@sports-management-sim/sport-lacrosse';
import { cpuWeeklyDrift, userWeeklyDrift } from './dynasty-helpers';

export type LandLabel = 'Likely' | 'Toss-up' | 'Long shot';

export interface LandChance {
  /** Rough chance he picks us, 0-1, if the race keeps its current shape. */
  probability: number;
  label: LandLabel;
  /** Strongest rival with an offer out, if any. */
  leaderTeamId?: string;
  /** Rival offers on the table. */
  rivalOffers: number;
  /** True when we haven't offered: the odds assume a typical offer goes out now. */
  hypothetical: boolean;
  /** One line for a tooltip: why the label says what it says. */
  detail: string;
}

export interface LandChanceContext {
  userTeam: LacrosseTeam;
  teams: LacrosseTeam[];
  currentWeek: number;
  finalWeek: number;
  /** Difficulty weight on our interest when he decides (see difficulty.ts). */
  decisionScale?: number;
  /** Difficulty scale on CPU programs' weekly interest gains. */
  cpuInterestScale?: number;
  teamName?: (teamId: string) => string;
}

/** The decision adds up to this much noise per school (chooseCommitTeam). */
const DECISION_NOISE = 8;
/** Each week left widens our side: pitches and visits can still move him. */
const USER_SWING_PER_WEEK = 4;
/** Rivals' scores spread with time left too: drift varies and new offers arrive. */
const RIVAL_SWING_PER_WEEK = 3;
/** Interest a typical staff adds per week with pitches on a target. */
const PITCH_EFFORT_PER_WEEK = 5;
const SAMPLES = 120;
const BLUE_CHIP_STARS = 4;

export const LIKELY_AT = 0.6;
export const TOSS_UP_AT = 0.3;

export function landLabel(probability: number): LandLabel {
  return probability >= LIKELY_AT ? 'Likely' : probability >= TOSS_UP_AT ? 'Toss-up' : 'Long shot';
}

/**
 * How likely an open recruit is to pick us. Interest is not a chance to land: a
 * recruit at 100 interest can still sign with a rival at 100. This projects
 * every offering school's interest to his decision week (CPU drift is steady;
 * ours is the passive drift plus room for pitches), then scores the race the
 * way the recruit decides: interest, program fit, money and a little noise.
 * Recruits who aren't on the market return undefined.
 */
export function landChance(recruit: LacrosseRecruit, ctx: LandChanceContext): LandChance | undefined {
  if (recruit.status !== 'open') return undefined;
  const { userTeam } = ctx;
  const decisionScale = ctx.decisionScale ?? 1;
  const cpuScale = ctx.cpuInterestScale ?? 1;
  const decisionWeek = recruitDecisionWeek(recruit.id, recruit.starRating, ctx.finalWeek);
  const weeksLeft = Math.max(0, decisionWeek - ctx.currentWeek);

  const ourOffer = recruit.scholarshipOffers.find((o) => o.teamId === userTeam.id);
  // Our staff keeps working him: about one decent pitch every other week.
  const pitchEffort =
    PITCH_EFFORT_PER_WEEK * Math.min(1.1, recruitPrestigeMultiplier(recruit.starRating, userTeam.reputation.nationalPrestige));
  const ourPercent = ourOffer?.scholarshipPercent ?? suggestedScholarshipPercent(recruit.starRating);
  const ourInterest = Math.min(
    100,
    (recruit.interestByTeamId[userTeam.id] ?? 0) + (userWeeklyDrift(recruit, userTeam, ourPercent) + pitchEffort) * weeksLeft,
  );
  const ourBase =
    ourInterest * decisionScale + calculateRecruitFitScore(recruit, userTeam) * 0.2 + ourPercent * 0.08;

  const rivals = recruit.scholarshipOffers
    .filter((o) => o.teamId !== userTeam.id)
    .flatMap((o) => {
      const team = ctx.teams.find((t) => t.id === o.teamId);
      if (!team) return [];
      const interest = Math.min(
        100,
        (recruit.interestByTeamId[team.id] ?? 0) + cpuWeeklyDrift(recruit, team, cpuScale, 0.5) * weeksLeft,
      );
      return [{ teamId: team.id, base: interest + calculateRecruitFitScore(recruit, team) * 0.2 + o.scholarshipPercent * 0.08 }];
    })
    .sort((a, b) => b.base - a.base);

  // Blue-chips always draw offers. Before any arrive, assume a program at his
  // level will come in and work him for the weeks that are left.
  const expectsSuitor = rivals.length === 0 && recruit.starRating >= BLUE_CHIP_STARS && weeksLeft > 0;
  const suitors = expectsSuitor
    ? [{ teamId: '', base: phantomSuitorBase(recruit, userTeam, weeksLeft, cpuScale) }]
    : rivals;

  // Our score: base plus decision noise, widened by the weeks we can still work him.
  const swing = DECISION_NOISE + USER_SWING_PER_WEEK * weeksLeft;
  const rivalSpread = DECISION_NOISE + RIVAL_SWING_PER_WEEK * weeksLeft;
  let total = 0;
  for (let i = 0; i < SAMPLES; i += 1) {
    const ours = ourBase + DECISION_NOISE / 2 + ((i + 0.5) / SAMPLES - 0.5) * swing;
    let beatsAll = 1;
    for (const rival of suitors) {
      // Rival scores spread too: their drift varies and new offers can still land.
      beatsAll *= Math.min(1, Math.max(0, (ours - rival.base) / rivalSpread + 0.5 - DECISION_NOISE / 2 / rivalSpread));
      if (beatsAll === 0) break;
    }
    total += beatsAll;
  }
  let probability = total / SAMPLES;
  // Nobody has offered yet: programs at his level will, so a reach stays a reach.
  if (rivals.length === 0 && !expectsSuitor) {
    probability *= Math.min(1, recruitPrestigeMultiplier(recruit.starRating, userTeam.reputation.nationalPrestige));
  }
  // Shade toward the middle: rival boards shift and new offers land in ways no
  // projection sees. Calibrated against simulated seasons (recruit-odds.test.ts).
  probability = Math.round((0.06 + 0.84 * probability) * 100) / 100;

  const leader = rivals[0];
  const nameOf = ctx.teamName ?? ((id: string) => id);
  const finalists = ctx.currentWeek >= decisionWeek - FINALIST_ANNOUNCE_LEAD;
  const when = weeksLeft === 0 ? 'decides any day' : `decides around Week ${decisionWeek}`;
  let detail: string;
  if (!leader) {
    detail = expectsSuitor
      ? `No rival offers yet, but bigger programs chase ${recruit.starRating}★ recruits; ${when}`
      : `No rival offers yet; ${when}`;
  } else {
    const nowGap = (recruit.interestByTeamId[userTeam.id] ?? 0) - (recruit.interestByTeamId[leader.teamId] ?? 0);
    const standing =
      nowGap > 0
        ? `We lead ${nameOf(leader.teamId)} by ${nowGap}`
        : nowGap < 0
          ? `${nameOf(leader.teamId)} leads us by ${-nowGap}`
          : `Level with ${nameOf(leader.teamId)}`;
    detail = `${standing} · ${rivals.length} rival offer${rivals.length === 1 ? '' : 's'} · ${finalists ? 'finalists named, ' : ''}${when}`;
  }
  if (!ourOffer) detail = `If you offer ${ourPercent}%: ${detail.charAt(0).toLowerCase()}${detail.slice(1)}`;

  return {
    probability,
    label: landLabel(probability),
    ...(leader ? { leaderTeamId: leader.teamId } : {}),
    rivalOffers: rivals.length,
    hypothetical: !ourOffer,
    detail,
  };
}

/**
 * A stand-in for the program that will offer a blue-chip nobody has offered
 * yet: prestige at his level, a typical 75% offer, and weekly CPU drift.
 */
function phantomSuitorBase(recruit: LacrosseRecruit, userTeam: LacrosseTeam, weeksLeft: number, cpuScale: number): number {
  const prestige = Math.min(95, 25 + recruit.starRating * 13);
  const weekly = Math.round((5 + recruit.starRating * 0.5 + (prestige / 100) * 4 + 1.5) * 1.1 * cpuScale);
  const interest = Math.min(100, weekly * weeksLeft);
  // Fit is mostly prestige and location; ours is the closest stand-in, lifted to his level.
  const fit = calculateRecruitFitScore(recruit, userTeam) + Math.max(0, prestige - userTeam.reputation.nationalPrestige) * 0.5;
  return interest + fit * 0.2 + 75 * 0.08;
}

/** Chances for every open recruit, keyed by id. */
export function landChances(recruits: LacrosseRecruit[], ctx: LandChanceContext): Map<string, LandChance> {
  const out = new Map<string, LandChance>();
  for (const recruit of recruits) {
    const chance = landChance(recruit, ctx);
    if (chance) out.set(recruit.id, chance);
  }
  return out;
}

/**
 * "Best for Us" ranks fit, need and quality; this folds in whether we can
 * actually land him. Board scores sit close together, so only long shots are
 * discounted: a toss-up blue-chip is still worth chasing, a five-star we have
 * no real shot at sinks below the targets we can win.
 */
export function attainableBoardScore(score: number, chance: LandChance | undefined): number {
  if (!chance) return score;
  return score * Math.min(1, 0.55 + 1.5 * chance.probability);
}
