import type { SeasonGameRecord } from './series-history';

/**
 * Weekly coach challenges: one optional target per game, sized to the
 * matchup, that pays coach XP when met. Favorites are asked to dominate,
 * underdogs to hang around or pull the upset.
 */

export type ChallengeKind = 'win' | 'win-by' | 'hold' | 'score' | 'within';

export interface WeeklyChallenge {
  kind: ChallengeKind;
  /** Goal margin for win-by/within, goals for score, goals allowed for hold. */
  target: number;
  xp: number;
  text: string;
}

export interface ChallengeResult {
  year: number;
  week: number;
  opponentId: string;
  text: string;
  xp: number;
  completed: boolean;
}

const make = (kind: ChallengeKind, target: number, xp: number): WeeklyChallenge => ({ kind, target, xp, text: describe(kind, target) });

function describe(kind: ChallengeKind, target: number): string {
  switch (kind) {
    case 'win':
      return 'Win the game';
    case 'win-by':
      return `Win by ${target} or more`;
    case 'hold':
      return `Hold them to ${target} goals or fewer`;
    case 'score':
      return `Score ${target} or more goals`;
    case 'within':
      return `Win, or lose by ${target} or fewer`;
  }
}

/**
 * The challenge for a game, from the rating edge (user overall minus
 * opponent overall). The week rotates through the options so a season of
 * similar matchups doesn't repeat one target.
 */
export function weeklyChallenge(ratingEdge: number, week: number): WeeklyChallenge {
  const options =
    ratingEdge >= 8
      ? [make('win-by', 6, 20), make('hold', 7, 20), make('score', 15, 20)]
      : ratingEdge >= 3
        ? [make('win-by', 3, 20), make('hold', 9, 15), make('win', 0, 15)]
        : ratingEdge > -3
          ? [make('win', 0, 20), make('hold', 10, 20)]
          : [make('within', 3, 20), make('win', 0, 35)];
  return options[Math.abs(week) % options.length]!;
}

export function challengeMet(challenge: WeeklyChallenge, game: Pick<SeasonGameRecord, 'goalsFor' | 'goalsAgainst'>): boolean {
  const margin = game.goalsFor - game.goalsAgainst;
  switch (challenge.kind) {
    case 'win':
      return margin > 0;
    case 'win-by':
      return margin >= challenge.target;
    case 'hold':
      return game.goalsAgainst <= challenge.target;
    case 'score':
      return game.goalsFor >= challenge.target;
    case 'within':
      return margin > 0 || -margin <= challenge.target;
  }
}

export function challengesCompleted(log: readonly ChallengeResult[]): number {
  return log.filter((c) => c.completed).length;
}
