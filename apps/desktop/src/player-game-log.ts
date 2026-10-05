import type { ScheduledGame } from '@sports-management-sim/engine-core';
import type { GameLog, LacrossePlayerGameStats } from '@sports-management-sim/sport-lacrosse';

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
    const line = gameLogs.get(game.id)?.playerLines?.find((l) => l.playerId === playerId);
    if (!line) continue;
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
