import type { ScheduledGame } from '@sports-management-sim/engine-core';
import {
  attendanceOf,
  calculateLacrosseTeamRating,
  eligibleNonConferenceOpponents,
  userNonConferenceSlots,
  rivalryFor,
  rivalryForGame,
  seriesSummary,
  type GameLog,
  type LacrosseTeam,
  type LacrosseTeamStats,
  type Rivalry,
  type RivalrySeriesMap,
} from '@sports-management-sim/sport-lacrosse';
import { formatTeamName } from '../ui/format';
import type { BoxScoreData } from '../ui/types';
import { getNextUserGamePreview } from '../schedule-preview';

export function ScheduleScreen({
  schedule,
  teams,
  teamMap,
  userTeamId,
  currentWeek,
  gameLogs,
  onBoxScore,
  rivalries = [],
  rivalrySeries = {},
  conferences = [],
  editable = false,
  onSwapNonConference,
}: {
  schedule: ScheduledGame[];
  teams: LacrosseTeam[];
  teamMap: Map<string, string>;
  userTeamId: string;
  currentWeek: number;
  gameLogs: Map<string, GameLog>;
  onBoxScore: (data: BoxScoreData) => void;
  rivalries?: Rivalry[];
  rivalrySeries?: RivalrySeriesMap;
  conferences?: Array<{ id: string; shortName: string; teamIds: string[] }>;
  editable?: boolean;
  onSwapNonConference?: (week: number, opponentId: string) => void;
}) {
  const rivalry = rivalryFor(rivalries, userTeamId);
  const rivalId = rivalry?.teamIds.find((id) => id !== userTeamId) ?? null;
  const series = rivalry ? rivalrySeries[rivalry.key] : undefined;
  const rivalGame = rivalId
    ? schedule.find((g) => (g.homeTeamId === rivalId && g.awayTeamId === userTeamId) || (g.awayTeamId === rivalId && g.homeTeamId === userTeamId))
    : undefined;
  const weeks = [...new Set(schedule.map((game) => game.week))].sort((a, b) => a - b);
  const nextPreview = getNextUserGamePreview({ schedule, teams, userTeamId, currentWeek });

  return (
    <div className="schedule-view-layout">
      <article className="card schedule-header-card">
        <p className="eyebrow">Season Schedule</p>
        <h2>Full Schedule</h2>
        <p className="dim">Review every matchup, result, and completed box score for the season.</p>
      </article>

      {rivalry && rivalId && (
        <article className="card rivalry-card" aria-label="Rivalry">
          <p className="eyebrow">Rivalry</p>
          <h2>{rivalry.trophy}</h2>
          <p>
            vs <strong>{formatTeamName(teamMap.get(rivalId) ?? rivalId)}</strong> · {seriesSummary(series, userTeamId, rivalId)}
            {series?.holderId && (
              <span className="dim">
                {' '}
                · {series.holderId === userTeamId ? 'You hold the trophy' : `${formatTeamName(teamMap.get(series.holderId) ?? series.holderId)} holds the trophy`}
              </span>
            )}
          </p>
          {rivalGame && (
            <p className="dim">
              {rivalGame.result
                ? `This season: ${rivalGame.result.winnerTeamId === userTeamId ? 'won' : 'lost'} ${Math.max(rivalGame.result.homeScore, rivalGame.result.awayScore)}-${Math.min(rivalGame.result.homeScore, rivalGame.result.awayScore)} in week ${rivalGame.week}.`
                : `This season: week ${rivalGame.week}, ${rivalGame.homeTeamId === userTeamId ? 'at home' : 'on the road'}. Rivalry results hit morale three times as hard.`}
            </p>
          )}
          {series && series.recent.length > 0 && (
            <ul className="rivalry-recent">
              {series.recent.map((r) => (
                <li key={`${r.year}-${r.score}`} className={r.winnerId === userTeamId ? 'mood-happy' : 'mood-unhappy'}>
                  {r.year}: {r.winnerId === userTeamId ? 'W' : 'L'} {r.score}
                </li>
              ))}
            </ul>
          )}
        </article>
      )}

      {onSwapNonConference && conferences.length > 0 && (
        <NonConferenceCard
          schedule={schedule}
          teams={teams}
          conferences={conferences}
          userTeamId={userTeamId}
          editable={editable}
          onSwap={onSwapNonConference}
        />
      )}

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
                    const log = gameLogs.get(game.id);
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
                    <tr
                      key={game.id}
                      className={userInGame ? (userWon ? 'schedule-user-game win' : result ? 'schedule-user-game loss' : 'schedule-user-game') : ''}
                    >
                      <td>
                        <strong>{formatTeamName(teamMap.get(game.awayTeamId) ?? game.awayTeamId)}</strong>
                        <span className="schedule-at"> at </span>
                        <strong>{formatTeamName(teamMap.get(game.homeTeamId) ?? game.homeTeamId)}</strong>
                        {rivalryForGame(rivalries, game) && (
                          <span className="rivalry-pill" title={rivalryForGame(rivalries, game)!.trophy}>
                            Rivalry
                          </span>
                        )}
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

function NonConferenceCard({
  schedule,
  teams,
  conferences,
  userTeamId,
  editable,
  onSwap,
}: {
  schedule: ScheduledGame[];
  teams: LacrosseTeam[];
  conferences: Array<{ id: string; shortName: string; teamIds: string[] }>;
  userTeamId: string;
  editable: boolean;
  onSwap: (week: number, opponentId: string) => void;
}) {
  const context = { schedule, conferences, userTeamId };
  const slots = userNonConferenceSlots(context);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const ratingById = new Map(teams.map((t) => [t.id, calculateLacrosseTeamRating(t).overall]));
  const conferenceName = (teamId: string) => conferences.find((c) => c.teamIds.includes(teamId))?.shortName ?? '';
  const label = (teamId: string) => {
    const team = teamById.get(teamId);
    return `${formatTeamName(team?.name ?? teamId)} (${conferenceName(teamId)}, OVR ${ratingById.get(teamId) ?? '?'}, Prestige ${team?.reputation.nationalPrestige ?? '?'})`;
  };
  if (slots.length === 0) return null;
  const avgOvr = Math.round(slots.reduce((sum, s) => sum + (ratingById.get(s.opponentId) ?? 0), 0) / slots.length);

  return (
    <article className="card nonconf-card" aria-label="Non-conference schedule">
      <p className="eyebrow">Non-Conference Schedule</p>
      <h2>Build Your Slate</h2>
      <p className="dim">
        {editable
          ? 'Swap any non-conference opponent before your first game. Tough games lift your RPI for NCAA selection; easy ones pad the record.'
          : 'Your season is underway, so the non-conference slate is locked until next year.'}{' '}
        Average opponent OVR: <strong>{avgOvr}</strong>.
      </p>
      <ul className="nonconf-list">
        {slots.map((slot) => {
          const options = editable ? eligibleNonConferenceOpponents(context, slot.week) : [];
          options.sort((a, b) => (ratingById.get(b) ?? 0) - (ratingById.get(a) ?? 0));
          return (
            <li key={slot.week}>
              <span className="nonconf-week">Week {slot.week}</span>
              <span className="nonconf-site">{slot.home ? 'vs' : 'at'}</span>
              {editable ? (
                <select
                  aria-label={`Week ${slot.week} opponent`}
                  value={slot.opponentId}
                  onChange={(e) => onSwap(slot.week, e.target.value)}
                >
                  <option value={slot.opponentId}>{label(slot.opponentId)}</option>
                  {options.map((id) => (
                    <option key={id} value={id}>
                      {label(id)}
                    </option>
                  ))}
                </select>
              ) : (
                <strong>{label(slot.opponentId)}</strong>
              )}
            </li>
          );
        })}
      </ul>
    </article>
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
