/**
 * Overall-rating points per logistic unit. Fit to simulated games: a +6 edge
 * wins about 73% of the time and a +12 edge about 88%.
 */
const RATING_POINTS_PER_LOGIT = 6;
/** Home field is worth about 1.6 rating points (home teams win ~57% of even games). */
const HOME_RATING_POINTS = 1.6;

/** Pregame win probability (0–100) from the overall team-rating edge. */
export function lacrosseWinProbability(ratingEdge: number, isHome: boolean, neutralSite: boolean): number {
  const homeAdjust = neutralSite ? 0 : isHome ? HOME_RATING_POINTS : -HOME_RATING_POINTS;
  const probability = 1 / (1 + Math.exp(-(ratingEdge + homeAdjust) / RATING_POINTS_PER_LOGIT));
  return Math.round(probability * 100);
}
