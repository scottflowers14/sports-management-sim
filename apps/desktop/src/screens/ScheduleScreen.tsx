import type { ScheduledGame } from '@sports-management-sim/engine-core';
import type { LacrosseTeam, LacrosseTeamStats } from '@sports-management-sim/sport-lacrosse';
import { formatTeamName } from '../ui/format';
import type { BoxScoreData } from '../ui/types';
import { getNextUserGamePreview } from '../schedule-preview';

export function ScheduleScreen({
  schedule,
  teams,
  teamMap,
  userTeamId,
  currentWeek,
  onBoxScore,
}: {
  schedule: ScheduledGame[];
  teams: LacrosseTeam[];
  teamMap: Map<string, string>;
  userTeamId: string;
  currentWeek: number;
  onBoxScore: (data: BoxScoreData) => void;
}) {
  const weeks = [...new Set(schedule.map((game) => game.week))].sort((a, b) => a - b);
  const nextPreview = getNextUserGamePreview({ schedule, teams, userTeamId, currentWeek });

  return (
    <div className="schedule-view-layout">
      <article className="card schedule-header-card">
        <p className="eyebrow">Season Schedule</p>
        <h2>Full Schedule</h2>
        <p className="dim">Review every matchup, result, and completed box score for the season.</p>
      </article>

      {nextPreview && (
        <article className="card matchup-preview-card" aria-label="Next game preview">
          <div className="matchup-preview-header">
            <div>
              <p className="eyebrow">Next Game Preview</p>
              <h2>Week {nextPreview.game.week}: {formatTeamName(nextPreview.opponent.name)}</h2>
              <p className="dim">
                {nextPreview.userIsHome ? 'Home' : 'Away'} game · {nextPreview.matchupNote}
              </p>
            </div>
            <div className="matchup-line">
              <span>{formatTeamName(nextPreview.userTeam.shortName)}</span>
              <strong>{nextPreview.userRating.overall}</strong>
              <span>vs</span>
              <strong>{nextPreview.opponentRating.overall}</strong>
              <span>{formatTeamName(nextPreview.opponent.shortName)}</span>
            </div>
          </div>
          <div className="matchup-edge-grid">
            <MatchupEdge label="Overall" edge={nextPreview.ratingEdge} />
            <MatchupEdge label="Your O vs Opp D" edge={nextPreview.offenseEdge} />
            <MatchupEdge label="Your D vs Opp O" edge={nextPreview.defenseEdge} />
            <MatchupEdge label="Goalie" edge={nextPreview.goalieEdge} />
            <MatchupEdge label="Faceoff" edge={nextPreview.faceoffEdge} />
          </div>
        </article>
      )}

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

function MatchupEdge({ label, edge }: { label: string; edge: number }) {
  const signed = edge > 0 ? `+${edge}` : `${edge}`;
  const className = edge > 0 ? 'positive' : edge < 0 ? 'negative' : 'even';

  return (
    <div className={`matchup-edge ${className}`}>
      <span>{label}</span>
      <strong>{signed}</strong>
    </div>
  );
}
