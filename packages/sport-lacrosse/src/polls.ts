import type { LacrosseTeam } from './models';
import { calculateLacrosseTeamRating } from './team-rating';

/**
 * Games after which results and reputation carry equal weight. Before any
 * games the poll is all roster strength and reputation (a preseason poll);
 * by season's end it's mostly the record.
 */
const POLL_RESULTS_HALF_LIFE = 4;

/**
 * Voters read a record against what they expected: early on, the win
 * percentage is blended with this many "expected" games at the team's
 * outlook, so one upset loss nudges a contender instead of sinking it.
 */
const POLL_PRIOR_GAMES = 3;

/**
 * A national poll score (0–100). Voters start from how good a roster looks and
 * how big the name is, then let the record take over as games are played.
 */
export function lacrossePollScore(team: LacrosseTeam): number {
  const games = team.record.wins + team.record.losses;
  const strength = calculateLacrosseTeamRating(team).overall;
  const outlook = clamp((strength - 40) * 2.5, 0, 100) * 0.75 + team.reputation.nationalPrestige * 0.25;
  const winPct = (team.record.wins + (POLL_PRIOR_GAMES * outlook) / 100) / (games + POLL_PRIOR_GAMES);
  const resultsWeight = games / (games + POLL_RESULTS_HALF_LIFE);
  return Math.round((resultsWeight * winPct * 100 + (1 - resultsWeight) * outlook) * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
