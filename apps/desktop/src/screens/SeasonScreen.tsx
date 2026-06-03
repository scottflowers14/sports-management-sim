import type { GameLog, LacrosseTeam, LacrosseTeamRating } from '@sports-management-sim/sport-lacrosse';
import type { ScheduledGame } from '@sports-management-sim/engine-core';
import { DepthChart } from '../components/DepthChart';
import { ResultRow } from '../components/ResultRow';
import type { TournamentState } from '../tournament';
import type { NewsItem } from '../news-feed';
import type { BoxScoreData } from '../ui/types';
import { formatTeamName } from '../ui/format';

export function SeasonScreen({
  currentWeek,
  seasonComplete,
  tournament,
  lastSimWeek,
  lastWeekGames,
  newsItems,
  userTeam,
  userInjuries,
  injuredCount,
  userTeamRating,
  upcomingGames,
  teamMap,
  userTeamId,
  gameLogs,
  onSimWeek,
  onEnterTournament,
  onViewTournament,
  onEnterOffseason,
  onBoxScore,
  onSelectPlayer,
}: {
  currentWeek: number;
  seasonComplete: boolean;
  tournament: TournamentState | null;
  lastSimWeek: number | null;
  lastWeekGames: ScheduledGame[];
  newsItems: NewsItem[];
  userTeam: LacrosseTeam;
  userInjuries: Set<string>;
  injuredCount: number;
  userTeamRating: LacrosseTeamRating;
  upcomingGames: ScheduledGame[];
  teamMap: Map<string, string>;
  userTeamId: string;
  gameLogs: Map<string, GameLog>;
  onSimWeek: () => void;
  onEnterTournament: () => void;
  onViewTournament: () => void;
  onEnterOffseason: () => void;
  onBoxScore: (data: BoxScoreData) => void;
  onSelectPlayer: (id: string) => void;
}) {
  return (
    <div className="season-layout">
      <div className="season-main">
        <article className="card">
          <h2>This Week</h2>
          {!seasonComplete ? (
            <button className="sim-btn" onClick={onSimWeek}>
              Sim Week {currentWeek}
            </button>
          ) : !tournament ? (
            <button className="tournament-btn" onClick={onEnterTournament}>
              Enter Conference Tournaments →
            </button>
          ) : tournament.phase !== 'complete' ? (
            <button className="tournament-btn" onClick={onViewTournament}>
              View Tournament Bracket →
            </button>
          ) : (
            <button className="offseason-btn" onClick={onEnterOffseason}>
              Enter Offseason →
            </button>
          )}
          {lastWeekGames.length > 0 && (
            <div className="results-block">
              <p className="section-label">Week {lastSimWeek} Results</p>
              <ul className="result-list">
                {lastWeekGames.map((game) => (
                  <ResultRow
                    key={game.id}
                    game={game}
                    teamMap={teamMap}
                    userTeamId={userTeamId}
                    gameLogs={gameLogs}
                    onBoxScore={onBoxScore}
                  />
                ))}
              </ul>
            </div>
          )}
        </article>

        {newsItems.length > 0 && (
          <article className="card">
            <h2>Latest News</h2>
            <ul className="news-list">
              {newsItems.slice(0, 6).map((item) => (
                <li key={item.id} className="news-item">
                  <span className={`news-chip chip-${item.category}`}>{item.category}</span>
                  <div>
                    <p className="news-headline">{item.headline}</p>
                    <p className="news-week">Wk {item.week}</p>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        )}
      </div>

      <div className="season-sidebar">
        <article className="card">
          <h2>Roster</h2>
          <p className="metric">{userTeam.roster.length} players</p>
          <p className="sub-metric">
            {userTeam.resources.scholarshipUsed.toFixed(1)} /{' '}
            {userTeam.resources.scholarshipLimit.toFixed(1)} scholarships
            {injuredCount > 0 && <span className="sidebar-inj"> · {injuredCount} inj</span>}
          </p>
          <div className="team-rating-summary" aria-label="Team rating summary">
            <div className="team-rating-overall">
              <span className="team-rating-number">{userTeamRating.overall}</span>
              <span className="team-rating-label">Team OVR</span>
            </div>
            <div className="team-rating-breakdown">
              <span>OFF {userTeamRating.offense}</span>
              <span>DEF {userTeamRating.defense}</span>
              <span>GK {userTeamRating.goalie}</span>
              <span>FO {userTeamRating.faceoff}</span>
            </div>
          </div>
          <DepthChart team={userTeam} injuries={userInjuries} />
          <ul className="player-roster-list">
            {userTeam.roster.map((p) => {
              const isInjured = userInjuries.has(p.id);
              return (
                <li
                  key={p.id}
                  className={`player-roster-row${isInjured ? ' player-injured' : ''}`}
                  onClick={() => onSelectPlayer(p.id)}
                >
                  <span className="player-row-name">
                    {p.name.first} {p.name.last}
                    {isInjured && <span className="inj-badge">INJ</span>}
                  </span>
                  <span className="player-row-meta">{p.position} · {p.classYear}</span>
                  <span className="player-row-ovr">{p.ratings.overall}</span>
                </li>
              );
            })}
          </ul>
        </article>

        <article className="card">
          <h2>Upcoming</h2>
          {upcomingGames.length > 0 ? (
            <ol>
              {upcomingGames.map((game) => (
                <li key={game.id}>
                  <strong>Wk {game.week}</strong>
                  <span>
                    {formatTeamName(teamMap.get(game.awayTeamId) ?? game.awayTeamId)} at{' '}
                    {formatTeamName(teamMap.get(game.homeTeamId) ?? game.homeTeamId)}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="dim">Season complete — check standings</p>
          )}
        </article>
      </div>
    </div>
  );
}
