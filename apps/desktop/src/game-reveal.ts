import type { ScheduledGame } from '@sports-management-sim/engine-core';
import type { GameLog } from '@sports-management-sim/sport-lacrosse';

/** The user's game, staged for the result card shown after a sim. */
export interface GameReveal {
  gameId: string;
  week: number;
  userIsHome: boolean;
  opponentId: string;
  userScore: number;
  opponentScore: number;
  won: boolean;
  overtime: boolean;
  /** Running score at the end of each period, for the scoreboard to tick through. */
  periods: Array<{ label: string; user: number; opponent: number }>;
  userRank: number | null;
  opponentRank: number | null;
  /** A win over a team ranked ahead of the user (or any ranked team when unranked). */
  upset: boolean;
  /** The trophy at stake, for rivalry games. */
  trophy: string | null;
}

/** Ranks going in, so an upset reads against the poll the game was played under. */
export interface RevealContext {
  userRank: number | null;
  opponentRank: number | null;
  trophy?: string | null;
}

export function buildGameReveal(
  game: ScheduledGame,
  log: GameLog | undefined,
  userTeamId: string,
  ctx: RevealContext,
): GameReveal | null {
  if (game.status !== 'final' || !game.result) return null;
  const userIsHome = game.homeTeamId === userTeamId;
  if (!userIsHome && game.awayTeamId !== userTeamId) return null;
  const { homeScore, awayScore } = game.result;
  const userScore = userIsHome ? homeScore : awayScore;
  const opponentScore = userIsHome ? awayScore : homeScore;
  const won = game.result.winnerTeamId === userTeamId;

  const periods: GameReveal['periods'] = [];
  for (const e of log?.events ?? []) {
    if (e.type !== 'period_end') continue;
    const label = e.period === 'OT' ? 'OT' : `Q${e.period}`;
    if (periods.some((p) => p.label === label)) continue;
    periods.push({ label, user: userIsHome ? e.homeScore : e.awayScore, opponent: userIsHome ? e.awayScore : e.homeScore });
  }
  // The final always closes the board, whatever the log kept.
  const last = periods.at(-1);
  if (!last || last.user !== userScore || last.opponent !== opponentScore) {
    periods.push({ label: 'Final', user: userScore, opponent: opponentScore });
  }

  const upset =
    won && ctx.opponentRank !== null && (ctx.userRank === null || ctx.userRank > ctx.opponentRank);
  return {
    gameId: game.id,
    week: game.week,
    userIsHome,
    opponentId: userIsHome ? game.awayTeamId : game.homeTeamId,
    userScore,
    opponentScore,
    won,
    overtime: game.result.overtime,
    periods,
    userRank: ctx.userRank,
    opponentRank: ctx.opponentRank,
    upset,
    trophy: ctx.trophy ?? null,
  };
}

/** The big word on the result card. */
export function revealStamp(reveal: GameReveal): string {
  if (!reveal.won) return 'LOSS';
  if (reveal.trophy) return 'TROPHY WIN';
  if (reveal.upset) return 'UPSET!';
  return 'WIN';
}
