import type { LacrossePlayerGameStats } from './models';

export interface GameStar {
  playerId: string;
  teamId: string;
  score: number;
  /** Short stat line, e.g. "3G 2A" or "17 SV". */
  line: string;
}

/**
 * How much a single game line is worth, hockey-style: goals and assists
 * lead, then the dirty work. Goalies earn their saves net of goals allowed.
 */
export function gameStarScore(line: LacrossePlayerGameStats): number {
  const saves = line.saves ?? 0;
  const allowed = line.goalsAllowed ?? 0;
  const goalie = saves > 0 || allowed > 0 ? Math.max(0, saves * 0.45 - allowed * 0.25) : 0;
  return (
    line.goals * 3 +
    line.assists * 2 +
    line.groundBalls * 0.5 +
    line.causedTurnovers * 1.5 +
    (line.faceoffWins ?? 0) * 0.35 +
    goalie -
    line.turnovers * 0.5
  );
}

export function gameStarLine(line: LacrossePlayerGameStats): string {
  const parts: string[] = [];
  if (line.saves) parts.push(`${line.saves} SV`);
  if (line.faceoffAttempts) parts.push(`${line.faceoffWins ?? 0}/${line.faceoffAttempts} FO`);
  if (line.goals) parts.push(`${line.goals}G`);
  if (line.assists) parts.push(`${line.assists}A`);
  if (line.causedTurnovers) parts.push(`${line.causedTurnovers} CT`);
  if (line.groundBalls) parts.push(`${line.groundBalls} GB`);
  return parts.slice(0, 3).join(' ') || '—';
}

/**
 * The game's three stars. Ties go to the winning side, then to goals, so the
 * order is stable.
 */
export function threeStars(lines: readonly LacrossePlayerGameStats[], winnerTeamId: string): GameStar[] {
  return [...lines]
    .map((line) => ({ line, score: gameStarScore(line) }))
    .filter((s) => s.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.line.teamId === winnerTeamId) - Number(a.line.teamId === winnerTeamId) ||
        b.line.goals - a.line.goals ||
        a.line.playerId.localeCompare(b.line.playerId),
    )
    .slice(0, 3)
    .map(({ line, score }) => ({ playerId: line.playerId, teamId: line.teamId, score, line: gameStarLine(line) }));
}
