import { lacrosseWinProbability } from '@sports-management-sim/sport-lacrosse';
import type { TournamentGame, TournamentState } from './tournament';

/** Each NCAA team's chance (0-1) of reaching every remaining stage of the bracket. */
export interface NcaaOdds {
  teamId: string;
  seed: number;
  /** Null when the bracket has no quarterfinals (small leagues). */
  quarterfinal: number | null;
  finalFour: number;
  titleGame: number;
  champion: number;
}

/** Who might fill a bracket slot, with the chance of each. */
type Slot = Map<string, number>;

const QUARTERFINAL_HOSTS = [1, 4, 3, 2];

function sure(teamId: string): Slot {
  return new Map([[teamId, 1]]);
}

/**
 * The winner of a game between two slots. `aHosts` puts slot A at home;
 * otherwise the site is neutral. Win chances come from the rating edge, the
 * same model as the pregame line.
 */
function play(a: Slot, b: Slot, ratingOf: (teamId: string) => number, aHosts: boolean): Slot {
  const out: Slot = new Map();
  const add = (id: string, p: number) => out.set(id, (out.get(id) ?? 0) + p);
  for (const [ta, pa] of a) {
    for (const [tb, pb] of b) {
      const aWins = lacrosseWinProbability(ratingOf(ta) - ratingOf(tb), true, !aHosts) / 100;
      add(ta, pa * pb * aWins);
      add(tb, pa * pb * (1 - aWins));
    }
  }
  return out;
}

function playGame(game: TournamentGame, ratingOf: (teamId: string) => number, neutral: boolean): Slot {
  if (game.result) return sure(game.result.winnerId);
  return play(sure(game.homeTeamId), sure(game.awayTeamId), ratingOf, !neutral);
}

function participants(slots: Slot[]): Slot {
  const out: Slot = new Map();
  for (const slot of slots) for (const [id, p] of slot) out.set(id, (out.get(id) ?? 0) + p);
  return out;
}

function gameSlots(game: TournamentGame): Slot[] {
  return [sure(game.homeTeamId), sure(game.awayTeamId)];
}

/**
 * Exact bracket odds from wherever the NCAA tournament stands: every
 * remaining game is weighed by its pregame win probability (home field in
 * the early rounds, neutral from the Final Four on). Null until the field is
 * set.
 */
export function ncaaOdds(state: TournamentState, ratingOf: (teamId: string) => number): NcaaOdds[] | null {
  const field = state.ncaaField;
  if (!field || field.length === 0) return null;
  const bySeed = (seed: number) => field.find((e) => e.seed === seed)?.teamId;

  let quarterfinalists: Slot | null = null;
  let semiSlots: Slot[] | null = null;
  if (state.ncaaQuarterfinals) {
    quarterfinalists = participants(state.ncaaQuarterfinals.flatMap(gameSlots));
    semiSlots = state.ncaaQuarterfinals.map((g) => playGame(g, ratingOf, false));
  } else if (state.ncaaFirstRound) {
    const r1Winners = state.ncaaFirstRound.map((g) => playGame(g, ratingOf, false));
    const hosts = QUARTERFINAL_HOSTS.map((seed) => sure(bySeed(seed)!));
    quarterfinalists = participants([...hosts, ...r1Winners]);
    semiSlots = hosts.map((host, i) => play(host, r1Winners[i]!, ratingOf, true));
  }

  let finalists: Slot[];
  let finalFour: Slot;
  if (state.nationalSemiFinal1 && state.nationalSemiFinal2) {
    const semis = [state.nationalSemiFinal1, state.nationalSemiFinal2];
    finalFour = participants(semis.flatMap(gameSlots));
    finalists = semis.map((g) => playGame(g, ratingOf, true));
  } else if (semiSlots) {
    finalFour = participants(semiSlots);
    finalists = [play(semiSlots[0]!, semiSlots[1]!, ratingOf, false), play(semiSlots[2]!, semiSlots[3]!, ratingOf, false)];
  } else if (state.nationalGame) {
    // Tiny leagues go straight to a title game.
    finalFour = participants(gameSlots(state.nationalGame));
    finalists = gameSlots(state.nationalGame);
  } else {
    return null;
  }

  const titleGame = state.nationalGame ? participants(gameSlots(state.nationalGame)) : participants(finalists);
  const champion = state.nationalChampion
    ? sure(state.nationalChampion)
    : state.nationalGame
      ? playGame(state.nationalGame, ratingOf, true)
      : play(finalists[0]!, finalists[1]!, ratingOf, false);

  return [...field]
    .sort((a, b) => a.seed - b.seed)
    .map((e) => ({
      teamId: e.teamId,
      seed: e.seed,
      quarterfinal: quarterfinalists ? (quarterfinalists.get(e.teamId) ?? 0) : null,
      finalFour: finalFour.get(e.teamId) ?? 0,
      titleGame: titleGame.get(e.teamId) ?? 0,
      champion: champion.get(e.teamId) ?? 0,
    }));
}

/** Odds as a whole percent, with "<1%" for long shots still alive and "Out" once eliminated. */
export function formatOdds(p: number | null): string {
  if (p === null) return '–';
  if (p >= 0.995) return p >= 1 ? '✓' : '>99%';
  if (p <= 0) return 'Out';
  if (p < 0.005) return '<1%';
  return `${Math.round(p * 100)}%`;
}
