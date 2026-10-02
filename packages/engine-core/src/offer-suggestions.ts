import type { ID, Team } from './models';
import type { RecruitBoardEntry } from './recruit-board';
import { recruitPrestigeMultiplier } from './recruiting';

export interface OfferSuggestion {
  recruitId: ID;
  position: string;
  scholarshipPercent: number;
  reason: string;
}

export interface SuggestOffersInput<Position extends string, SportTraits> {
  team: Team<Position, SportTraits>;
  /** The team's recruit board, best fit first. */
  board: RecruitBoardEntry<Position, SportTraits>[];
  /** Scholarship equivalencies still free in this class (1 = one full ride). */
  budgetRemaining: number;
  /** Whether the staff knows enough about a recruit to offer (scouted or nationally ranked). */
  isKnown: (recruitId: ID) => boolean;
  /** Cap on suggestions per call. */
  maxOffers?: number;
}

/** Offers per open spot: some targets will sign elsewhere. */
const OFFERS_PER_SPOT = 1.5;
/** Long shots (a 5-star who won't look at a 40-prestige program) aren't worth the money. */
const MIN_ATTAINABILITY = 0.6;
/** Smallest offer worth making. */
const MIN_PERCENT = 25;

/** Typical split of a lacrosse class budget: blue-chips get most of the money. */
export function suggestedScholarshipPercent(starRating: number): number {
  if (starRating >= 5) return 75;
  if (starRating === 4) return 50;
  if (starRating === 3) return 33;
  return MIN_PERCENT;
}

/**
 * Plan scholarship offers the way a recruiting coordinator would: replace this
 * year's graduates position by position (offering about 1.5 recruits per open
 * spot, since some will go elsewhere), best fits first, only to recruits the
 * staff has evaluated and could realistically land, within the class budget.
 * It only suggests; the head coach makes the offers.
 */
export function suggestScholarshipOffers<Position extends string, SportTraits>(
  input: SuggestOffersInput<Position, SportTraits>,
): OfferSuggestion[] {
  const { team, board, isKnown, maxOffers = 8 } = input;
  let budget = input.budgetRemaining;

  const graduating = new Map<string, number>();
  for (const player of team.roster) {
    if (player.classYear === 'SR' || player.classYear === 'GR') {
      graduating.set(player.position, (graduating.get(player.position) ?? 0) + 1);
    }
  }
  const pledged = new Map<string, number>();
  const outstanding = new Map<string, number>();
  for (const { recruit } of board) {
    if (recruit.committedTeamId === team.id || recruit.signedTeamId === team.id) {
      pledged.set(recruit.position, (pledged.get(recruit.position) ?? 0) + 1);
    } else if (recruit.status === 'open' && recruit.scholarshipOffers.some((o) => o.teamId === team.id)) {
      outstanding.set(recruit.position, (outstanding.get(recruit.position) ?? 0) + 1);
    }
  }
  const openOffers = new Map<string, number>();
  for (const [position, count] of graduating) {
    const spots = Math.max(0, count - (pledged.get(position) ?? 0));
    openOffers.set(position, Math.ceil(spots * OFFERS_PER_SPOT) - (outstanding.get(position) ?? 0));
  }

  const suggestions: OfferSuggestion[] = [];
  for (const { recruit } of board) {
    if (suggestions.length >= maxOffers || budget < MIN_PERCENT / 100) break;
    if (recruit.status !== 'open') continue;
    if (recruit.scholarshipOffers.some((o) => o.teamId === team.id)) continue;
    if ((openOffers.get(recruit.position) ?? 0) <= 0) continue;
    if (!isKnown(recruit.id)) continue;
    if (recruitPrestigeMultiplier(recruit.starRating, team.reputation.nationalPrestige) < MIN_ATTAINABILITY) continue;

    const desired = suggestedScholarshipPercent(recruit.starRating);
    const percent = desired / 100 <= budget ? desired : MIN_PERCENT;
    budget -= percent / 100;
    openOffers.set(recruit.position, (openOffers.get(recruit.position) ?? 0) - 1);
    suggestions.push({
      recruitId: recruit.id,
      position: recruit.position,
      scholarshipPercent: percent,
      reason: `Replaces a graduating ${recruit.position}`,
    });
  }
  return suggestions;
}
