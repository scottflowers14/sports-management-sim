import type { ScheduledGame } from '@sports-management-sim/engine-core';
import { threeStars, type GameLog, type LacrossePlayerGameStats } from '@sports-management-sim/sport-lacrosse';

/** One row of a player's game-by-game log, OOTP style. */
export interface PlayerGameRow {
  gameId: string;
  week: number;
  opponentId: string;
  home: boolean;
  won: boolean;
  /** Player's team first: "12-9". */
  score: string;
  overtime: boolean;
  line: LacrossePlayerGameStats;
  /** 1, 2 or 3 when he was one of the game's three stars. */
  star?: 1 | 2 | 3;
}

/**
 * Every game this season with a stat line for the player, oldest first. Games
 * whose play-by-play was trimmed from the save (other programs' older games)
 * have no lines and drop out.
 */
export function playerGameLog(playerId: string, schedule: readonly ScheduledGame[], gameLogs: ReadonlyMap<string, GameLog>): PlayerGameRow[] {
  const rows: PlayerGameRow[] = [];
  for (const game of schedule) {
    if (game.status !== 'final' || !game.result) continue;
    const lines = gameLogs.get(game.id)?.playerLines;
    const line = lines?.find((l) => l.playerId === playerId);
    if (!lines || !line) continue;
    const starIndex = threeStars(lines, game.result.winnerTeamId).findIndex((s) => s.playerId === playerId);
    const home = line.teamId === game.homeTeamId;
    const ours = home ? game.result.homeScore : game.result.awayScore;
    const theirs = home ? game.result.awayScore : game.result.homeScore;
    rows.push({
      gameId: game.id,
      week: game.week,
      opponentId: home ? game.awayTeamId : game.homeTeamId,
      home,
      won: game.result.winnerTeamId === line.teamId,
      score: `${ours}-${theirs}`,
      overtime: game.result.overtime,
      line,
      ...(starIndex >= 0 ? { star: (starIndex + 1) as 1 | 2 | 3 } : {}),
    });
  }
  return rows.sort((a, b) => a.week - b.week);
}

export interface GameLogColumn {
  label: string;
  value: (line: LacrossePlayerGameStats) => string | number;
}

export function gameLogColumns(position: string): GameLogColumn[] {
  if (position === 'GK') {
    return [
      { label: 'SV', value: (l) => l.saves ?? 0 },
      { label: 'GA', value: (l) => l.goalsAllowed ?? 0 },
      {
        label: 'SV%',
        value: (l) => {
          const faced = (l.saves ?? 0) + (l.goalsAllowed ?? 0);
          return faced > 0 ? `${Math.round(((l.saves ?? 0) / faced) * 100)}%` : '—';
        },
      },
      { label: 'GB', value: (l) => l.groundBalls },
    ];
  }
  if (position === 'FOGO') {
    return [
      { label: 'FO', value: (l) => `${l.faceoffWins ?? 0}-${(l.faceoffAttempts ?? 0) - (l.faceoffWins ?? 0)}` },
      {
        label: 'FO%',
        value: (l) => ((l.faceoffAttempts ?? 0) > 0 ? `${Math.round(((l.faceoffWins ?? 0) / (l.faceoffAttempts ?? 1)) * 100)}%` : '—'),
      },
      { label: 'GB', value: (l) => l.groundBalls },
      { label: 'PTS', value: (l) => l.goals + l.assists },
    ];
  }
  if (position === 'DEF' || position === 'LSM') {
    return [
      { label: 'CT', value: (l) => l.causedTurnovers },
      { label: 'GB', value: (l) => l.groundBalls },
      { label: 'TO', value: (l) => l.turnovers },
      { label: 'PIM', value: (l) => l.penaltyMinutes },
    ];
  }
  return [
    { label: 'G', value: (l) => l.goals },
    { label: 'A', value: (l) => l.assists },
    { label: 'SH', value: (l) => `${l.shotsOnGoal}/${l.shots}` },
    { label: 'GB', value: (l) => l.groundBalls },
    { label: 'TO', value: (l) => l.turnovers },
  ];
}

/** How many times he was each star this season: [1st, 2nd, 3rd]. */
export function starCounts(rows: readonly PlayerGameRow[]): [number, number, number] {
  const counts: [number, number, number] = [0, 0, 0];
  for (const r of rows) if (r.star) counts[r.star - 1] = (counts[r.star - 1] ?? 0) + 1;
  return counts;
}
