import type { ScheduledGame } from '@sports-management-sim/engine-core';
import { gameStarScore, type GameLog, type LacrossePlayer } from '@sports-management-sim/sport-lacrosse';
import { playerGameLog, type PlayerGameRow } from './player-game-log';

export type FormTrend = 'hot' | 'cold';

export interface PlayerForm {
  trend: FormTrend;
  /** Average game score over the last three games. */
  recent: number;
  /** Average game score in the games before those. */
  baseline: number;
  /** Short line for the last three games, e.g. "7G 4A in his last 3". */
  line: string;
}

/** Games that make up a hot or cold stretch. */
export const FORM_WINDOW = 3;
/** Earlier games needed before a stretch means anything. */
export const FORM_MIN_BASELINE = 2;
/** A stretch must beat (or trail) the baseline by this ratio... */
const FORM_RATIO = 1.5;
/** ...and by at least this many game-score points. */
const FORM_MIN_GAP = 2.5;
/** Depth players who barely touch the ball don't get streaks: the better of the two averages must reach this. */
const FORM_MIN_SCORE = 4;

function average(rows: readonly PlayerGameRow[]): number {
  return rows.length > 0 ? rows.reduce((sum, r) => sum + gameStarScore(r.line), 0) / rows.length : 0;
}

function stretchLine(rows: readonly PlayerGameRow[], position: string): string {
  const sum = (f: (r: PlayerGameRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  const tail = `in his last ${rows.length}`;
  if (position === 'GK') {
    const saves = sum((r) => r.line.saves ?? 0);
    const allowed = sum((r) => r.line.goalsAllowed ?? 0);
    const faced = saves + allowed;
    return `${faced > 0 ? Math.round((saves / faced) * 100) : 0}% saves ${tail}`;
  }
  if (position === 'FOGO') {
    const wins = sum((r) => r.line.faceoffWins ?? 0);
    const attempts = sum((r) => r.line.faceoffAttempts ?? 0);
    return `${wins}/${attempts} faceoffs ${tail}`;
  }
  if (position === 'DEF' || position === 'LSM') {
    return `${sum((r) => r.line.causedTurnovers)} CT, ${sum((r) => r.line.groundBalls)} GB ${tail}`;
  }
  return `${sum((r) => r.line.goals)}G ${sum((r) => r.line.assists)}A ${tail}`;
}

/**
 * OOTP-style hot and cold streaks: the last three games against the games
 * before them, by the same game score the three stars use. Most players are
 * neither, so this returns null unless the gap is large both in ratio and in
 * absolute terms.
 */
export function playerFormFromLog(rows: readonly PlayerGameRow[], position: string): PlayerForm | null {
  if (rows.length < FORM_WINDOW + FORM_MIN_BASELINE) return null;
  const recentRows = rows.slice(-FORM_WINDOW);
  const recent = average(recentRows);
  const baseline = average(rows.slice(0, -FORM_WINDOW));
  const line = stretchLine(recentRows, position);
  if (Math.max(recent, baseline) < FORM_MIN_SCORE) return null;
  if (recent >= baseline * FORM_RATIO && recent - baseline >= FORM_MIN_GAP) return { trend: 'hot', recent, baseline, line };
  if (recent * FORM_RATIO <= baseline && baseline - recent >= FORM_MIN_GAP) return { trend: 'cold', recent, baseline, line };
  return null;
}

/** Form for every player on a roster who is currently hot or cold. */
export function rosterForm(
  roster: readonly LacrossePlayer[],
  schedule: readonly ScheduledGame[],
  gameLogs: ReadonlyMap<string, GameLog>,
): Map<string, PlayerForm> {
  const form = new Map<string, PlayerForm>();
  for (const player of roster) {
    const f = playerFormFromLog(playerGameLog(player.id, schedule, gameLogs), player.position);
    if (f) form.set(player.id, f);
  }
  return form;
}
