import { simulatePossessionGame } from './possession-sim';
import type { LacrosseGamePlayerDetail, LacrosseGameResult, SimulateLacrosseGameInput } from './possession-sim';

/** Simulate a game possession by possession and return only the final result. */
export function simulateLacrosseGame(input: SimulateLacrosseGameInput): LacrosseGameResult {
  return simulatePossessionGame(input).result;
}

/**
 * Simulate a game and also return the individual stat lines. The player detail
 * is returned separately from the result so callers can keep stored schedules lean.
 */
export function simulateLacrosseGameDetailed(input: SimulateLacrosseGameInput): {
  result: LacrosseGameResult;
  players: LacrosseGamePlayerDetail;
} {
  const { result, players } = simulatePossessionGame(input);
  return { result, players };
}
