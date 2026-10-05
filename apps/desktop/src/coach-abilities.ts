import { VACANT_STAFF_RATING } from '@sports-management-sim/sport-lacrosse';
import type { LacrosseStaff, StaffRole } from '@sports-management-sim/sport-lacrosse';

/**
 * Head coach abilities, in the spirit of College Football's coach skill trees:
 * a coach earns XP from his seasons and spends it on four tracks. Each tier
 * makes the matching staff role play as if its coordinator were better.
 */
export type CoachAbility = 'recruiter' | 'developer' | 'playCaller' | 'defensiveMind';

export const COACH_ABILITIES: CoachAbility[] = ['recruiter', 'developer', 'playCaller', 'defensiveMind'];

export const COACH_ABILITY_INFO: Record<CoachAbility, { title: string; role: StaffRole; blurb: string }> = {
  recruiter: { title: 'Recruiter', role: 'recruiting', blurb: 'You work the phones yourself: more recruiting hours.' },
  developer: { title: 'Developer', role: 'development', blurb: 'Hands-on teaching: more offseason growth.' },
  playCaller: { title: 'Play Caller', role: 'offense', blurb: 'You call the offense: more scoring chances.' },
  defensiveMind: { title: 'Defensive Mind', role: 'defense', blurb: 'You run the defense: fewer chances allowed.' },
};

export const MAX_ABILITY_TIER = 3;
/** Each tier plays like five more rating points from that coordinator. */
export const ABILITY_TIER_BONUS = 5;
/** XP for one ability point. A solid season earns about one. */
export const XP_PER_POINT = 150;
/** A new head coach arrives with one point to spend. */
export const STARTING_COACH_XP = XP_PER_POINT;
const STAFF_RATING_CAP = 99;

export type CoachAbilities = Partial<Record<CoachAbility, number>>;

export interface CoachProgress {
  xp?: number;
  abilities?: CoachAbilities;
}

export interface CoachXpAward {
  year: number;
  total: number;
  lines: { label: string; xp: number }[];
}

export interface SeasonXpInput {
  year: number;
  wins: number;
  confChampion: boolean;
  nationalChampion: boolean;
  coachOfYear: boolean;
  goalsMet: number;
  proPicks: number;
  firstRoundPicks: number;
}

export function seasonCoachXp(season: SeasonXpInput): CoachXpAward {
  const lines: CoachXpAward['lines'] = [];
  const add = (label: string, xp: number) => {
    if (xp > 0) lines.push({ label, xp });
  };
  add(`${season.wins} win${season.wins === 1 ? '' : 's'}`, season.wins * 15);
  add(`${season.goalsMet} season goal${season.goalsMet === 1 ? '' : 's'} met`, season.goalsMet * 20);
  if (season.confChampion) add('Conference title', 50);
  if (season.nationalChampion) add('National title', 100);
  if (season.coachOfYear) add('Coach of the Year', 50);
  add(`${season.proPicks} pro draft pick${season.proPicks === 1 ? '' : 's'}`, season.proPicks * 10 + season.firstRoundPicks * 10);
  return { year: season.year, total: lines.reduce((sum, line) => sum + line.xp, 0), lines };
}

export function coachXp(progress: CoachProgress): number {
  return progress.xp ?? STARTING_COACH_XP;
}

/** Tier n costs n points, so a maxed track costs 1 + 2 + 3 = 6. */
export function tierCost(nextTier: number): number {
  return nextTier;
}

export function spentPoints(abilities: CoachAbilities = {}): number {
  return COACH_ABILITIES.reduce((sum, ability) => {
    const tier = abilities[ability] ?? 0;
    return sum + (tier * (tier + 1)) / 2;
  }, 0);
}

export function availablePoints(progress: CoachProgress): number {
  return Math.floor(coachXp(progress) / XP_PER_POINT) - spentPoints(progress.abilities);
}

/** XP still needed for the next point. */
export function xpToNextPoint(progress: CoachProgress): number {
  return XP_PER_POINT - (coachXp(progress) % XP_PER_POINT);
}

export function canUpgrade(progress: CoachProgress, ability: CoachAbility): boolean {
  const tier = progress.abilities?.[ability] ?? 0;
  return tier < MAX_ABILITY_TIER && availablePoints(progress) >= tierCost(tier + 1);
}

/** Buys the next tier; returns the same object when it can't. */
export function upgradeAbility<T extends CoachProgress>(progress: T, ability: CoachAbility): T {
  if (!canUpgrade(progress, ability)) return progress;
  const tier = progress.abilities?.[ability] ?? 0;
  return { ...progress, xp: coachXp(progress), abilities: { ...progress.abilities, [ability]: tier + 1 } };
}

export function addCoachXp<T extends CoachProgress>(progress: T, xp: number): T {
  return { ...progress, xp: coachXp(progress) + xp };
}

export function abilityStaffBonus(abilities: CoachAbilities = {}, role: StaffRole): number {
  const ability = COACH_ABILITIES.find((a) => COACH_ABILITY_INFO[a].role === role)!;
  return (abilities[ability] ?? 0) * ABILITY_TIER_BONUS;
}

/**
 * The staff as it plays with the head coach's abilities added. Only for
 * reading ratings: it fills vacant chairs with a graduate assistant, so it
 * must never be saved or shown as the hired staff.
 */
export function withCoachAbilities(staff: LacrosseStaff, abilities: CoachAbilities = {}): LacrosseStaff {
  let effective: LacrosseStaff = staff;
  for (const ability of COACH_ABILITIES) {
    const role = COACH_ABILITY_INFO[ability].role;
    const bonus = abilityStaffBonus(abilities, role);
    if (bonus === 0) continue;
    const member = staff[role] ?? {
      id: `graduate-assistant-${role}`,
      name: { first: 'Graduate', last: 'Assistant' },
      role,
      rating: VACANT_STAFF_RATING,
      salary: 0,
      yearsLeft: 0,
    };
    effective = { ...effective, [role]: { ...member, rating: Math.min(STAFF_RATING_CAP, member.rating + bonus) } };
  }
  return effective;
}
