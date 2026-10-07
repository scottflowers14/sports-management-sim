import type {
  GameLog,
  LacrosseGamePlan,
  LacrosseTeam,
  LacrosseTeamRating,
} from '@sports-management-sim/sport-lacrosse';

export type { OpponentScout } from '../components/GamePlanPanel';
import { GamePlanPanel, type OpponentScout } from '../components/GamePlanPanel';
import type { ScheduledGame } from '@sports-management-sim/engine-core';
import { DepthChart } from '../components/DepthChart';
import { ResultRow } from '../components/ResultRow';
import { WeeklyHub } from '../components/WeeklyHub';
import type { WeeklyHubData } from '../weekly-hub';
import type { TournamentState } from '../tournament';
import type { NewsItem } from '../news-feed';
import { TRAINING_FOCUS_LABELS, type TrainingFocus } from '../dynasty-helpers';
import type { BoxScoreData } from '../ui/types';
import { formatTeamName } from '../ui/format';

export function SeasonScreen({
  currentWeek,
  seasonComplete,
  tournament,
  lastSimWeek,
  lastWeekGames,
  rankOf,
  newsItems,
  userTeam,
  userInjuries,
  injuredCount,
  userTeamRating,
  upcomingGames,
  teamMap,
  userTeamId,
  gameLogs,
  gamePlan,
  trainingFocus,
  nextOpponentScout,
  weeklyHub,
  onGamePlanChange,
  autoGamePlan,
  onUseStaffPlan,
  onTrainingFocusChange,
  onSimWeek,
  onCoachGame,
  onSimToEnd,
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
  /** Current national rank, shown on results. */
  rankOf?: (teamId: string) => number | null;
  newsItems: NewsItem[];
  userTeam: LacrosseTeam;
  userInjuries: Set<string>;
  injuredCount: number;
  userTeamRating: LacrosseTeamRating;
  upcomingGames: ScheduledGame[];
  teamMap: Map<string, string>;
  userTeamId: string;
  gameLogs: Map<string, GameLog>;
  gamePlan: LacrosseGamePlan;
  trainingFocus: TrainingFocus;
  nextOpponentScout: OpponentScout | null;
  weeklyHub: WeeklyHubData | null;
  onGamePlanChange: (plan: LacrosseGamePlan) => void;
  /** The staff is setting the plan from the roster. */
  autoGamePlan?: boolean;
  /** Hand the plan back to the staff. */
  onUseStaffPlan?: () => void;
  onTrainingFocusChange: (focus: TrainingFocus) => void;
  onSimWeek: () => void;
  /** Play the user's game to halftime and adjust; absent when there's no game to coach. */
  onCoachGame?: (() => void) | undefined;
  onSimToEnd: () => void;
  onEnterTournament: () => void;
  onViewTournament: () => void;
  onEnterOffseason: () => void;
  onBoxScore: (data: BoxScoreData) => void;
  onSelectPlayer: (id: string) => void;
}) {
  return (
    <div className="season-layout">
      <div className="season-main">
        {weeklyHub && <WeeklyHub hub={weeklyHub} onSelectPlayer={onSelectPlayer} />}

        <article className="card">
          <h2>This Week</h2>
          {!seasonComplete ? (
            <div className="sim-actions">
              <button className="sim-btn" onClick={onSimWeek}>
                Sim Week {currentWeek}
              </button>
              {onCoachGame && (
                <button className="sim-btn sim-btn-secondary" onClick={onCoachGame}>
                  Coach the Game
                </button>
              )}
              <button className="sim-btn sim-btn-secondary" onClick={onSimToEnd}>
                Sim to End of Season ⏩
              </button>
            </div>
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
                    rankOf={rankOf}
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
        <article className="card gameplan-card">
          <h2>Coaching</h2>
          <GamePlanPanel
            scout={nextOpponentScout}
            gamePlan={gamePlan}
            onGamePlanChange={onGamePlanChange}
            autoGamePlan={autoGamePlan}
            onUseStaffPlan={onUseStaffPlan}
          />
          <label className="gameplan-row">
            <span className="gameplan-label">Training Focus</span>
            <select
              value={trainingFocus}
              onChange={(e) => onTrainingFocusChange(e.target.value as TrainingFocus)}
            >
              {(Object.keys(TRAINING_FOCUS_LABELS) as TrainingFocus[]).map((focus) => (
                <option key={focus} value={focus}>
                  {TRAINING_FOCUS_LABELS[focus].label}
                </option>
              ))}
            </select>
          </label>
          <p className="gameplan-hint">{TRAINING_FOCUS_LABELS[trainingFocus].hint} · applies in the offseason</p>
        </article>

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
