import { getLacrosseParticipationMinutes } from './lineups';
import type { LacrossePlayer, LacrosseTeam } from './models';
import type { RandomSource } from './possession-sim';

export interface LacrosseInjury {
  playerId: string;
  teamId: string;
  /** Games missed, starting with the next week. */
  weeksOut: number;
  description: string;
}

/** Chance a player on the field for a full game gets hurt badly enough to miss time. */
export const GAME_INJURY_RATE = 0.02;
/** Weekly chance for anyone else on the roster (practice knocks). */
export const PRACTICE_INJURY_RATE = 0.0015;

interface InjuryType {
  description: string;
  weeks: [number, number];
  /** Relative frequency. */
  weight: number;
}

/** Most injuries cost a week or two; a few end the season. */
export const LACROSSE_INJURY_TYPES: InjuryType[] = [
  { description: 'ankle sprain', weeks: [1, 2], weight: 22 },
  { description: 'hamstring strain', weeks: [1, 3], weight: 18 },
  { description: 'bruised ribs', weeks: [1, 1], weight: 12 },
  { description: 'concussion', weeks: [1, 3], weight: 12 },
  { description: 'shoulder separation', weeks: [2, 4], weight: 10 },
  { description: 'broken hand', weeks: [3, 5], weight: 9 },
  { description: 'high ankle sprain', weeks: [3, 5], weight: 8 },
  { description: 'knee sprain (MCL)', weeks: [3, 6], weight: 6 },
  { description: 'torn ACL', weeks: [12, 12], weight: 3 },
];

/**
 * How injury-prone a player is: durable, well-conditioned athletes get hurt
 * less. A 50-stamina/50-strength player is 1.25x baseline, a 90/90 player 0.85x.
 */
export function lacrosseInjuryProneness(player: LacrossePlayer): number {
  const durability = (player.ratings.stamina + player.ratings.strength) / 2;
  return Math.min(1.5, Math.max(0.6, 1.75 - durability / 100));
}

/**
 * Roll a week of injuries for one team. Risk follows time on the field: a
 * starter who plays every minute faces the full game rate, a reserve who never
 * leaves the bench only the practice rate. Teams on a bye only practice.
 */
export function rollLacrosseInjuries(
  team: LacrosseTeam,
  options: { played: boolean; random: RandomSource; skipPlayerIds?: Set<string> },
): LacrosseInjury[] {
  const { played, random, skipPlayerIds } = options;
  const minutes = played ? getLacrosseParticipationMinutes(team) : new Map<string, number>();
  const injuries: LacrosseInjury[] = [];
  for (const player of team.roster) {
    if (skipPlayerIds?.has(player.id)) continue;
    const onField = minutes.get(player.id) ?? 0;
    const risk = (PRACTICE_INJURY_RATE + GAME_INJURY_RATE * onField) * lacrosseInjuryProneness(player);
    if (random() >= risk) continue;
    const type = pickInjuryType(random);
    const [min, max] = type.weeks;
    injuries.push({
      playerId: player.id,
      teamId: team.id,
      weeksOut: min + Math.floor(random() * (max - min + 1)),
      description: type.description,
    });
  }
  return injuries;
}

function pickInjuryType(random: RandomSource): InjuryType {
  const total = LACROSSE_INJURY_TYPES.reduce((s, t) => s + t.weight, 0);
  let roll = random() * total;
  for (const type of LACROSSE_INJURY_TYPES) {
    roll -= type.weight;
    if (roll < 0) return type;
  }
  return LACROSSE_INJURY_TYPES[0]!;
}
