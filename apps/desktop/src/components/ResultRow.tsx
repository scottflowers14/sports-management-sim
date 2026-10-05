import type { ScheduledGame } from '@sports-management-sim/engine-core';
import { attendanceOf } from '@sports-management-sim/sport-lacrosse';
import type { GameLog, LacrosseTeamStats } from '@sports-management-sim/sport-lacrosse';
import { formatTeamName } from '../ui/format';
import type { BoxScoreData } from '../ui/types';

export function ResultRow({
  game,
  teamMap,
  userTeamId,
  gameLogs,
  onBoxScore,
  rankOf,
}: {
  game: ScheduledGame;
  teamMap: Map<string, string>;
  userTeamId: string;
  gameLogs?: Map<string, GameLog>;
  onBoxScore?: (data: BoxScoreData) => void;
  /** Current national rank; teams in the top 20 show it before their name. */
  rankOf?: ((teamId: string) => number | null) | undefined;
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
      ...(attendanceOf(game) ? { attendance: attendanceOf(game)! } : {}),
    });
  };

  return (
    <li
      className={`${className}${result.teamStats && onBoxScore ? ' clickable' : ''}`}
      onClick={result.teamStats && onBoxScore ? handleClick : undefined}
    >
      <span className="result-teams">
        <RankTag rank={rankOf?.(game.awayTeamId) ?? null} />
        {formatTeamName(teamMap.get(game.awayTeamId) ?? game.awayTeamId)}
        <span className="result-score">{result.awayScore}–{result.homeScore}</span>
        <RankTag rank={rankOf?.(game.homeTeamId) ?? null} />
        {formatTeamName(teamMap.get(game.homeTeamId) ?? game.homeTeamId)}
        {result.overtime && <span className="ot-badge">OT</span>}
      </span>
      {result.teamStats && onBoxScore && <span className="box-score-hint">box score →</span>}
    </li>
  );
}

/** Ranks shown on results, like a scoreboard. */
export const RESULT_RANK_CUTOFF = 20;

function RankTag({ rank }: { rank: number | null }) {
  if (rank === null || rank > RESULT_RANK_CUTOFF) return null;
  return <span className="result-rank">#{rank}</span>;
}
