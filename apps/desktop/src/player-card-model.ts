import { POSITION_KEY_RATINGS, type DevelopableRating, type LacrossePlayer, type LacrosseRecruit } from '@sports-management-sim/sport-lacrosse';
import type { PlayerRatings } from '@sports-management-sim/engine-core';

/**
 * A normalized identity card used everywhere a person is shown in detail —
 * a recruit on the board (with scouting fog), a roster player, a transfer.
 * Builders below adapt each source type into this single shape so one
 * `PlayerCard` component renders them all.
 */
export type CardBadgeTone = 'inj' | 'good' | 'warn' | 'info' | 'star';

export interface CardBadge {
  label: string;
  tone: CardBadgeTone;
}

export interface CardRatingRow {
  label: string;
  /** null when the value is hidden (e.g. an unscouted recruit). */
  value: number | null;
}

export interface PlayerCardData {
  name: string;
  /** Position · class/stars · hometown line. */
  subtitle: string;
  badges: CardBadge[];
  /** null = unknown/hidden. */
  overall: number | null;
  /** Show a ~ prefix to signal an estimated (partially scouted) value. */
  overallFuzzy: boolean;
  potential: number | null;
  ratings: CardRatingRow[];
  /** The lacrosse skills that matter at his position (shooting, faceoffs...). */
  skills: CardRatingRow[];
  traits: string[];
}

export const SKILL_LABELS: Record<DevelopableRating, string> = {
  shooting: 'Shooting',
  passing: 'Passing',
  dodging: 'Dodging',
  stickSkills: 'Stick Skills',
  offBallMovement: 'Off-Ball',
  defense: 'Defense',
  checking: 'Checking',
  groundBalls: 'Ground Balls',
  faceoffs: 'Faceoffs',
  goalieReflexes: 'Reflexes',
  goaliePositioning: 'Positioning',
  goalieClearing: 'Clearing',
  athleticism: 'Athleticism',
  speed: 'Speed',
  strength: 'Strength',
  stamina: 'Stamina',
};

function skillRows(person: LacrossePlayer | LacrosseRecruit, visible: boolean): CardRatingRow[] {
  return POSITION_KEY_RATINGS[person.position].flatMap((key) => {
    const value = (person.sportTraits as unknown as Record<string, number | undefined>)[key];
    return value === undefined ? [] : [{ label: SKILL_LABELS[key], value: visible ? value : null }];
  });
}

const RATING_ROWS: Array<[string, keyof PlayerRatings]> = [
  ['Athleticism', 'athleticism'],
  ['Speed', 'speed'],
  ['Strength', 'strength'],
  ['Skill', 'skill'],
  ['IQ', 'iq'],
  ['Work Ethic', 'workEthic'],
];

export function cardFromPlayer(player: LacrossePlayer, opts: { injured?: boolean } = {}): PlayerCardData {
  const badges: CardBadge[] = [];
  if (opts.injured) badges.push({ label: 'INJ', tone: 'inj' });
  if (player.redshirtStatus === 'redshirting') badges.push({ label: 'RS', tone: 'info' });

  return {
    name: `${player.name.first} ${player.name.last}`,
    subtitle: `${player.position} · ${player.classYear} · ${player.hometown}`,
    badges,
    overall: player.ratings.overall,
    overallFuzzy: false,
    potential: player.ratings.potential,
    ratings: RATING_ROWS.map(([label, key]) => ({ label, value: player.ratings[key] })),
    skills: skillRows(player, true),
    traits: player.traits.map((t) => t.replace(/_/g, ' ')),
  };
}

export function cardFromRecruit(
  recruit: LacrosseRecruit,
  { tier, displayOvr, starsPublic }: { tier: 'none' | 'partial' | 'full'; displayOvr: number | null; starsPublic: boolean },
): PlayerCardData {
  const showRatings = tier === 'full';
  const showStars = tier !== 'none' || starsPublic;
  const starStr = showStars
    ? `${'★'.repeat(recruit.starRating)}${'☆'.repeat(5 - recruit.starRating)}`
    : '? stars';

  const badges: CardBadge[] = [];
  if (starsPublic) badges.push({ label: 'Top 100', tone: 'star' });
  if (recruit.status === 'committed') badges.push({ label: 'Committed', tone: 'info' });
  if (recruit.status === 'signed') badges.push({ label: 'Signed', tone: 'good' });

  return {
    name: `${recruit.name.first} ${recruit.name.last}`,
    subtitle: `${recruit.position} · ${starStr} · ${recruit.hometown}`,
    badges,
    overall: displayOvr,
    overallFuzzy: tier === 'partial',
    potential: showRatings ? recruit.ratings.potential : null,
    ratings: RATING_ROWS.map(([label, key]) => ({ label, value: showRatings ? recruit.ratings[key] : null })),
    skills: skillRows(recruit, showRatings),
    traits: [],
  };
}
