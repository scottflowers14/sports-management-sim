import { getLacrosseParticipationMinutes } from './lineups';
import type { LacrossePlayer, LacrossePlayerTraits, LacrossePosition, LacrosseTeam } from './models';
import { developmentBonusFor } from './staff';

export type PracticeIntensity = 'light' | 'normal' | 'intense';
export type DevelopmentFocusArea = 'balanced' | 'shooting' | 'playmaking' | 'defense' | 'faceoffs' | 'goaltending' | 'athleticism';

export interface DevelopmentPlan {
  playerId: string;
  focus: DevelopmentFocusArea;
}

export interface LacrossePracticePlan {
  intensity: PracticeIntensity;
  /** Individual plans: these players get extra coaching every week. */
  developmentPlans: DevelopmentPlan[];
}

/** Progress points that buy one overall point. */
export const PROGRESS_PER_POINT = 100;
/** How many players a staff can give individual plans at once. */
export const MAX_DEVELOPMENT_PLANS = 4;
/** Weekly progress for an average player with room to grow, before modifiers. */
export const BASE_WEEKLY_PROGRESS = 9;
/** Extra weekly progress for a full game's worth of minutes. */
export const GAME_REPS_PROGRESS = 4;
/** An individual plan multiplies a player's weekly progress. */
export const DEVELOPMENT_PLAN_MULTIPLIER = 2;
/**
 * In-season growth replaces part of the offseason jump, so the league's
 * overall development rate stays where it was. Added to every offseason roll.
 */
export const IN_SEASON_DEVELOPMENT_OFFSET = -0.3;

export const PRACTICE_INTENSITIES: Record<
  PracticeIntensity,
  { label: string; progress: number; injuryRisk: number; description: string }
> = {
  light: { label: 'Light', progress: 0.6, injuryRisk: 0.7, description: 'Walk-throughs and film. Fresh legs, slower growth.' },
  normal: { label: 'Normal', progress: 1, injuryRisk: 1, description: 'A standard week of full-pad practice.' },
  intense: { label: 'Intense', progress: 1.45, injuryRisk: 1.4, description: 'Live reps every day. Faster growth, more injuries.' },
};

type TraitKey = Exclude<keyof LacrossePlayerTraits, 'preferredHand'>;
type PhysicalKey = 'athleticism' | 'speed' | 'strength' | 'stamina';
/** A rating a development plan can raise: a lacrosse skill or a physical tool. */
export type DevelopableRating = TraitKey | PhysicalKey;

const PHYSICAL_KEYS: readonly PhysicalKey[] = ['athleticism', 'speed', 'strength', 'stamina'];

export const DEVELOPMENT_FOCUS_AREAS: Record<
  DevelopmentFocusArea,
  { label: string; ratings: readonly DevelopableRating[]; description: string }
> = {
  balanced: { label: 'Balanced', ratings: [], description: 'His two weakest skills and weakest physical tool' },
  shooting: { label: 'Shooting', ratings: ['shooting', 'offBallMovement'], description: 'Shooting and off-ball movement' },
  playmaking: { label: 'Playmaking', ratings: ['passing', 'dodging', 'stickSkills'], description: 'Passing, dodging and stick skills' },
  defense: { label: 'Defense', ratings: ['defense', 'checking', 'groundBalls'], description: 'Defense, checking and ground balls' },
  faceoffs: { label: 'Faceoffs', ratings: ['faceoffs', 'groundBalls'], description: 'Faceoffs and ground balls' },
  goaltending: { label: 'Goaltending', ratings: ['goalieReflexes', 'goaliePositioning', 'goalieClearing'], description: 'Reflexes, positioning and clearing' },
  athleticism: { label: 'Athleticism', ratings: PHYSICAL_KEYS, description: 'Athleticism, speed, strength and stamina' },
};

/** The skills that matter most at each position, which a balanced plan works on. */
export const POSITION_KEY_RATINGS: Record<LacrossePosition, readonly DevelopableRating[]> = {
  ATT: ['shooting', 'dodging', 'passing', 'stickSkills', 'offBallMovement'],
  MID: ['shooting', 'passing', 'dodging', 'stickSkills', 'groundBalls', 'defense'],
  DEF: ['defense', 'checking', 'groundBalls', 'stickSkills'],
  LSM: ['defense', 'checking', 'groundBalls', 'stickSkills'],
  FOGO: ['faceoffs', 'groundBalls', 'stickSkills'],
  GK: ['goalieReflexes', 'goaliePositioning', 'goalieClearing'],
};

/** The focus areas that make sense for a position, the natural one first. */
export function focusAreasFor(position: LacrossePosition): DevelopmentFocusArea[] {
  switch (position) {
    case 'ATT':
      return ['balanced', 'shooting', 'playmaking', 'athleticism'];
    case 'MID':
      return ['balanced', 'shooting', 'playmaking', 'defense', 'athleticism'];
    case 'DEF':
    case 'LSM':
      return ['balanced', 'defense', 'playmaking', 'athleticism'];
    case 'FOGO':
      return ['balanced', 'faceoffs', 'athleticism'];
    case 'GK':
      return ['balanced', 'goaltending', 'athleticism'];
  }
}

export const DEFAULT_PRACTICE_PLAN: LacrossePracticePlan = { intensity: 'normal', developmentPlans: [] };

export interface PracticeGain {
  playerId: string;
  from: number;
  to: number;
  /** The skills that improved with it. */
  improved: DevelopableRating[];
}

export interface PracticeWeekOptions {
  /** Development coordinator rating. */
  developmentRating: number;
  /** Whether the team played this week; game minutes add reps. */
  played: boolean;
  /** Injured players don't practice. */
  skipPlayerIds?: ReadonlySet<string>;
}

/**
 * One week of practice progress for a player. Growth slows as a player nears
 * his ceiling and stops at it; work ethic, the development coordinator,
 * practice intensity, an individual plan and game minutes all speed it up.
 */
export function weeklyPracticeProgress(
  player: LacrossePlayer,
  options: { intensity: PracticeIntensity; hasPlan: boolean; developmentRating: number; minutesShare: number },
): number {
  const gap = player.ratings.potential - player.ratings.overall;
  if (gap <= 0) return 0;
  const room = Math.min(1, gap / 10);
  const workEthic = 0.5 + player.ratings.workEthic / 100;
  const staff = 1 + developmentBonusFor(options.developmentRating) * 3;
  const practice = BASE_WEEKLY_PROGRESS * PRACTICE_INTENSITIES[options.intensity].progress;
  const plan = options.hasPlan ? DEVELOPMENT_PLAN_MULTIPLIER : 1;
  const reps = GAME_REPS_PROGRESS * Math.min(1, Math.max(0, options.minutesShare));
  return Math.max(0, (practice * plan + reps) * workEthic * staff * room);
}

function ratingValue(player: LacrossePlayer, key: DevelopableRating): number | undefined {
  return (PHYSICAL_KEYS as readonly string[]).includes(key)
    ? player.ratings[key as PhysicalKey]
    : player.sportTraits[key as TraitKey];
}

/**
 * Which skills a point of growth goes to. A focused plan raises every skill in
 * its area; a balanced one raises his two weakest skills at his position and his
 * weakest physical tool.
 * Goalie and faceoff skills only grow for players who have them.
 */
export function ratingsImprovedBy(player: LacrossePlayer, focus: DevelopmentFocusArea): DevelopableRating[] {
  const has = (key: DevelopableRating) => ratingValue(player, key) !== undefined;
  if (focus !== 'balanced') {
    const keys = DEVELOPMENT_FOCUS_AREAS[focus].ratings.filter(has);
    if (keys.length > 0) return [...keys];
  }
  const weakest = (keys: readonly DevelopableRating[], count: number) =>
    keys
      .filter(has)
      .sort((a, b) => (ratingValue(player, a) ?? 0) - (ratingValue(player, b) ?? 0) || a.localeCompare(b))
      .slice(0, count);
  return [...weakest(POSITION_KEY_RATINGS[player.position], 2), ...weakest(PHYSICAL_KEYS, 1)];
}

/** Raise skills on a player, capped at 99. */
export function raiseRatings(player: LacrossePlayer, keys: readonly DevelopableRating[], amount: number): LacrossePlayer {
  if (keys.length === 0 || amount === 0) return player;
  const ratings = { ...player.ratings };
  const sportTraits = { ...player.sportTraits };
  for (const key of keys) {
    if ((PHYSICAL_KEYS as readonly string[]).includes(key)) {
      const k = key as PhysicalKey;
      ratings[k] = clampRating(ratings[k] + amount);
    } else {
      const k = key as TraitKey;
      const current = sportTraits[k];
      if (current !== undefined) sportTraits[k] = clampRating(current + amount);
    }
  }
  return { ...player, ratings, sportTraits };
}

/**
 * Offseason growth moves a player's lacrosse skills with his overall, the same
 * way new players' skills are generated around their overall. Without this a
 * player's shooting or faceoffs stayed at his freshman level forever.
 */
export function carryOverallChangeToSkills(player: LacrossePlayer, overallBefore: number): LacrossePlayer {
  const delta = player.ratings.overall - overallBefore;
  if (delta === 0) return player;
  const keys = (Object.keys(player.sportTraits) as Array<keyof LacrossePlayerTraits>).filter(
    (key): key is TraitKey => key !== 'preferredHand' && typeof player.sportTraits[key] === 'number',
  );
  const sportTraits = { ...player.sportTraits };
  for (const key of keys) sportTraits[key] = clampRating((sportTraits[key] as number) + delta);
  return { ...player, sportTraits };
}

function clampRating(value: number): number {
  return Math.min(99, Math.max(1, Math.round(value)));
}

/** Apply one week of practice to a team, turning banked progress into rating points. */
export function runPracticeWeek(
  team: LacrosseTeam,
  plan: LacrossePracticePlan,
  options: PracticeWeekOptions,
): { team: LacrosseTeam; gains: PracticeGain[] } {
  const minutes = options.played ? getLacrosseParticipationMinutes(team) : new Map<string, number>();
  const plans = new Map(plan.developmentPlans.slice(0, MAX_DEVELOPMENT_PLANS).map((p) => [p.playerId, p.focus]));
  const gains: PracticeGain[] = [];
  const roster = team.roster.map((player) => {
    if (options.skipPlayerIds?.has(player.id)) return player;
    const focus = plans.get(player.id);
    const earned = weeklyPracticeProgress(player, {
      intensity: plan.intensity,
      hasPlan: focus !== undefined,
      developmentRating: options.developmentRating,
      minutesShare: minutes.get(player.id) ?? 0,
    });
    let progress = (player.developmentProgress ?? 0) + earned;
    let current = player;
    while (progress >= PROGRESS_PER_POINT && current.ratings.overall < current.ratings.potential) {
      progress -= PROGRESS_PER_POINT;
      const improved = ratingsImprovedBy(current, focus ?? 'balanced');
      const from = current.ratings.overall;
      current = raiseRatings({ ...current, ratings: { ...current.ratings, overall: from + 1 } }, improved, 1);
      gains.push({ playerId: player.id, from, to: from + 1, improved });
    }
    if (current.ratings.overall >= current.ratings.potential) progress = 0;
    const rounded = Math.round(progress * 10) / 10;
    if (current === player && rounded === (player.developmentProgress ?? 0)) return player;
    return { ...current, developmentProgress: rounded };
  });
  return { team: gains.length === 0 && roster.every((p, i) => p === team.roster[i]) ? team : { ...team, roster }, gains };
}

/**
 * CPU staffs put their individual plans on the young players with the most
 * room to grow, with the focus on each player's weakest area.
 */
export function autoDevelopmentPlans(team: LacrosseTeam, count = MAX_DEVELOPMENT_PLANS): DevelopmentPlan[] {
  return team.roster
    .filter((p) => p.classYear !== 'SR' && p.classYear !== 'GR' && p.ratings.potential > p.ratings.overall)
    .sort(
      (a, b) =>
        b.ratings.potential - b.ratings.overall - (a.ratings.potential - a.ratings.overall) ||
        b.ratings.potential - a.ratings.potential ||
        a.id.localeCompare(b.id),
    )
    .slice(0, count)
    .map((p) => ({ playerId: p.id, focus: 'balanced' as const }));
}

/** Drop plans for players who are no longer on the roster. */
export function prunePracticePlan(plan: LacrossePracticePlan, team: LacrosseTeam): LacrossePracticePlan {
  const ids = new Set(team.roster.map((p) => p.id));
  const kept = plan.developmentPlans.filter((p) => ids.has(p.playerId));
  return kept.length === plan.developmentPlans.length ? plan : { ...plan, developmentPlans: kept };
}
