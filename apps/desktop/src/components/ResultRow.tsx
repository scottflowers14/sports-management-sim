import type { ScheduledGame } from '@sports-management-sim/engine-core';
import type { GameLog, LacrosseTeamStats } from '@sports-management-sim/sport-lacrosse';
import { formatTeamName } from '../ui/format';
import type { BoxScoreData } from '../ui/types';

export function ResultRow({
  game,
  teamMap,
  userTeamId,
  gameLogs,
  onBoxScore,
}: {
  game: ScheduledGame;
  teamMap: Map<string, string>;
  userTeamId: string;
  gameLogs?: Map<string, GameLog>;
  onBoxScore?: (data: BoxScoreData) => void;
}) {
  const { result } = game;
  if (!result) return null;

  const userInGame = game.homeTeamId === userTeamId || game.awayTeamId === userTeamId;
  const userWon = result.winnerTeamId === userTeamId;
  const className = userInGame ? (userWon ? 'result-row win' : 'result-row loss') : 'result-row';

  const handleClick = () => {
    if (!result.teamStats || !onBoxScore) return;
    const log = gameLogs?.get(game.id);
    onBoxScore({
      title: `Week ${game.week}`,
      homeTeamName: teamMap.get(game.homeTeamId) ?? game.homeTeamId,
      awayTeamName: teamMap.get(game.awayTeamId) ?? game.awayTeamId,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      overtime: result.overtime,
      homeStats: result.teamStats.home as LacrosseTeamStats,
      awayStats: result.teamStats.away as LacrosseTeamStats,
      ...(log ? { log } : {}),
    });
  };

  return (
    <li
      className={`${className}${result.teamStats && onBoxScore ? ' clickable' : ''}`}
      onClick={result.teamStats && onBoxScore ? handleClick : undefined}
    >
      <span className="result-teams">
        {formatTeamName(teamMap.get(game.awayTeamId) ?? game.awayTeamId)}
        <span className="result-score">{result.awayScore}–{result.homeScore}</span>
        {formatTeamName(teamMap.get(game.homeTeamId) ?? game.homeTeamId)}
        {result.overtime && <span className="ot-badge">OT</span>}
      </span>
      {result.teamStats && onBoxScore && <span className="box-score-hint">box score →</span>}
    </li>
  );
}
