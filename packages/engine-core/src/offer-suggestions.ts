import type { ID, Team } from './models';
import type { RecruitBoardEntry } from './recruit-board';
import { classNeedsByPosition } from './class-needs';
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

  const openOffers = new Map<string, number>();
  for (const need of classNeedsByPosition(team, board.map((entry) => entry.recruit))) {
    if (need.graduating === 0) continue;
    openOffers.set(need.position, Math.ceil(need.open * OFFERS_PER_SPOT) - need.offersOut);
  }

  const eligible = board.filter(
    ({ recruit }) =>
      recruit.status === 'open' &&
      !recruit.scholarshipOffers.some((o) => o.teamId === team.id) &&
      isKnown(recruit.id) &&
      recruitPrestigeMultiplier(recruit.starRating, team.reputation.nationalPrestige) >= MIN_ATTAINABILITY,
  );
  // Every position with a hole gets its best fit first, so a class doesn't
  // spend its money on three attackers and leave the cage empty. Extra
  // offers come after, best fits first.
  const firstPicks = new Map<string, (typeof eligible)[number]>();
  for (const entry of eligible) {
    const position = entry.recruit.position;
    if ((openOffers.get(position) ?? 0) > 0 && !firstPicks.has(position)) firstPicks.set(position, entry);
  }
  const ordered = [...firstPicks.values(), ...eligible.filter((entry) => !new Set(firstPicks.values()).has(entry))];
  let uncovered = firstPicks.size;

  const suggestions: OfferSuggestion[] = [];
  for (const { recruit } of ordered) {
    if (suggestions.length >= maxOffers || budget < MIN_PERCENT / 100 - 1e-9) break;
    if ((openOffers.get(recruit.position) ?? 0) <= 0) continue;
    const isFirstPick = firstPicks.get(recruit.position)?.recruit.id === recruit.id;
    if (isFirstPick) uncovered -= 1;
    // Keep enough back to put at least a minimum offer on every uncovered position.
    const reserve = (uncovered * MIN_PERCENT) / 100;
    if (!isFirstPick && budget - MIN_PERCENT / 100 < reserve - 1e-9) continue;

    const desired = suggestedScholarshipPercent(recruit.starRating);
    const percent = desired / 100 <= budget - reserve + 1e-9 ? desired : MIN_PERCENT;
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
