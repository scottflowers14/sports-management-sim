import type { ScheduledGame } from '@sports-management-sim/engine-core';
import type { LacrosseTeamStats } from '@sports-management-sim/sport-lacrosse';
import { formatTeamName } from '../ui/format';
import type { BoxScoreData } from '../ui/types';

export function ScheduleScreen({
  schedule,
  teamMap,
  userTeamId,
  onBoxScore,
}: {
  schedule: ScheduledGame[];
  teamMap: Map<string, string>;
  userTeamId: string;
  onBoxScore: (data: BoxScoreData) => void;
}) {
  const weeks = [...new Set(schedule.map((game) => game.week))].sort((a, b) => a - b);

  return (
    <div className="schedule-view-layout">
      <article className="card schedule-header-card">
        <p className="eyebrow">Season Schedule</p>
        <h2>Full Schedule</h2>
        <p className="dim">Review every matchup, result, and completed box score for the season.</p>
      </article>

      {weeks.map((week) => {
        const weekGames = schedule.filter((game) => game.week === week);
        const userGame = weekGames.find((game) => game.homeTeamId === userTeamId || game.awayTeamId === userTeamId);

        return (
          <article key={week} className="card schedule-week-card">
            <div className="schedule-week-header">
              <h3>Week {week}</h3>
              {userGame && <span className="user-game-pill">Your game</span>}
            </div>
            <table className="standings-table schedule-table">
              <thead>
                <tr>
                  <th>Matchup</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Box</th>
                </tr>
              </thead>
              <tbody>
                {weekGames.map((game) => {
                  const result = game.result;
                  const userInGame = game.homeTeamId === userTeamId || game.awayTeamId === userTeamId;
                  const userWon = result?.winnerTeamId === userTeamId;
                  const canOpenBox = Boolean(result?.teamStats);

                  const openBoxScore = () => {
                    if (!result?.teamStats) return;
                    onBoxScore({
                      title: `Week ${game.week}`,
                      homeTeamName: teamMap.get(game.homeTeamId) ?? game.homeTeamId,
                      awayTeamName: teamMap.get(game.awayTeamId) ?? game.awayTeamId,
                      homeScore: result.homeScore,
                      awayScore: result.awayScore,
                      overtime: result.overtime,
                      homeStats: result.teamStats.home as LacrosseTeamStats,
                      awayStats: result.teamStats.away as LacrosseTeamStats,
                    });
                  };

                  return (
                    <tr
                      key={game.id}
                      className={userInGame ? (userWon ? 'schedule-user-game win' : result ? 'schedule-user-game loss' : 'schedule-user-game') : ''}
                    >
                      <td>
                        <strong>{formatTeamName(teamMap.get(game.awayTeamId) ?? game.awayTeamId)}</strong>
                        <span className="schedule-at"> at </span>
                        <strong>{formatTeamName(teamMap.get(game.homeTeamId) ?? game.homeTeamId)}</strong>
                      </td>
                      <td>{result ? `Final${result.overtime ? ' OT' : ''}` : 'Scheduled'}</td>
                      <td>{result ? `${result.awayScore}–${result.homeScore}` : '—'}</td>
                      <td>
                        {canOpenBox ? (
                          <button className="box-score-btn" onClick={openBoxScore}>
                            View
                          </button>
                        ) : (
                          <span className="dim">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </article>
        );
      })}
    </div>
  );
}
