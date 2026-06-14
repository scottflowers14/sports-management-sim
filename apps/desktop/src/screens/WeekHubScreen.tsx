import type { GameLog, LacrosseTeam, LacrossePortalEntry, LacrossePosition, LacrossePlayerTraits } from '@sports-management-sim/sport-lacrosse';
import type { RecruitBoardEntry, ScheduledGame } from '@sports-management-sim/engine-core';
import type { InjuredPlayer } from '../dynasty-helpers';
import type { RankingEntry } from '../rankings';
import type { NewsItem } from '../news-feed';
import type { ScoutingState } from '../scouting';
import type { WeeklyHubData } from '../weekly-hub';
import type { BoxScoreData } from '../ui/types';
import { ResultRow } from '../components/ResultRow';
import { formatTeamName } from '../ui/format';

interface ActionItem {
  id: string;
  priority: 'high' | 'medium' | 'low';
  icon: string;
  text: string;
  nav?: string;
}

function computeActionItems({
  injuries,
  userTeam,
  scouting,
  recruitBoard,
  portalEntries,
  userTeamId,
  seasonComplete,
}: {
  injuries: InjuredPlayer[];
  userTeam: LacrosseTeam;
  scouting: ScoutingState;
  recruitBoard: RecruitBoardEntry<LacrossePosition, LacrossePlayerTraits>[];
  portalEntries: LacrossePortalEntry[];
  userTeamId: string;
  seasonComplete: boolean;
}): ActionItem[] {
  const items: ActionItem[] = [];

  const keyPositions = new Set(['GK', 'FOGO']);
  const keyInjured = injuries.filter((inj) => {
    const player = userTeam.roster.find((p) => p.id === inj.playerId);
    return player && keyPositions.has(player.position);
  });
  if (keyInjured.length > 0) {
    const names = keyInjured.map((inj) => {
      const p = userTeam.roster.find((pl) => pl.id === inj.playerId);
      return p ? `${p.name.last} (${p.position})` : inj.playerId;
    });
    items.push({
      id: 'key-injury',
      priority: 'high',
      icon: '🚨',
      text: `Key player${keyInjured.length > 1 ? 's' : ''} injured — adjust depth chart: ${names.join(', ')}`,
      nav: 'team',
    });
  }

  if (scouting.pointsAvailable > 0 && recruitBoard.length > 0) {
    const topUnscouted = recruitBoard.find(
      (e) => !scouting.fullIds.includes(e.recruit.id) && !(e.recruit.id in scouting.partialIds),
    );
    if (topUnscouted) {
      items.push({
        id: 'scout',
        priority: 'medium',
        icon: '🔍',
        text: `${scouting.pointsAvailable} scouting point${scouting.pointsAvailable > 1 ? 's' : ''} available — scout ${topUnscouted.recruit.name.first} ${topUnscouted.recruit.name.last} (${topUnscouted.recruit.position})`,
        nav: 'recruiting',
      });
    }
  }

  const portalTargets = portalEntries.filter(
    (e) => e.status === 'available' && !e.offersByTeamId[userTeamId],
  );
  if (portalTargets.length > 0) {
    items.push({
      id: 'portal',
      priority: 'medium',
      icon: '📋',
      text: `${portalTargets.length} transfer portal player${portalTargets.length > 1 ? 's' : ''} available — consider making offers`,
      nav: 'recruiting',
    });
  }

  const offeredUnscouted = recruitBoard.filter(
    (e) =>
      e.recruit.scholarshipOffers.some((offer) => offer.teamId === userTeamId) &&
      !scouting.fullIds.includes(e.recruit.id),
  );
  if (offeredUnscouted.length > 0) {
    items.push({
      id: 'offered-unscouted',
      priority: 'low',
      icon: '📄',
      text: `${offeredUnscouted.length} offered recruit${offeredUnscouted.length > 1 ? 's' : ''} not fully scouted — scout before commit`,
      nav: 'recruiting',
    });
  }

  const scholarshipsLeft = userTeam.resources.scholarshipLimit - userTeam.resources.scholarshipUsed;
  if (scholarshipsLeft >= 3) {
    items.push({
      id: 'scholarships',
      priority: 'low',
      icon: '🎓',
      text: `${scholarshipsLeft.toFixed(1)} scholarships available — extend offers to top recruits`,
      nav: 'recruiting',
    });
  }

  if (items.length === 0) {
    items.push({
      id: 'all-good',
      priority: 'low',
      icon: '✅',
      text: seasonComplete
        ? 'Season complete — head to the tournament or offseason.'
        : 'Everything looks good — ready to sim.',
    });
  }

  return items;
}

export function WeekHubScreen({
  currentWeek,
  seasonComplete,
  userTeam,
  userRankEntry,
  injuries,
  newsItems,
  scouting,
  portalEntries,
  recruitBoard,
  weeklyHub,
  teamMap,
  userTeamId,
  lastSimWeek,
  lastWeekGames,
  gameLogs,
  onSimWeek,
  onBoxScore,
  onNavigate,
}: {
  currentWeek: number;
  seasonComplete: boolean;
  userTeam: LacrosseTeam;
  userRankEntry: RankingEntry | null;
  injuries: InjuredPlayer[];
  newsItems: NewsItem[];
  scouting: ScoutingState;
  portalEntries: LacrossePortalEntry[];
  recruitBoard: RecruitBoardEntry<LacrossePosition, LacrossePlayerTraits>[];
  weeklyHub: WeeklyHubData | null;
  teamMap: Map<string, string>;
  userTeamId: string;
  lastSimWeek: number | null;
  lastWeekGames: ScheduledGame[];
  gameLogs: Map<string, GameLog>;
  onSimWeek: () => void;
  onBoxScore: (data: BoxScoreData) => void;
  onNavigate: (view: string) => void;
}) {
  const recentRecruitNews = newsItems.filter((n) => n.category === 'recruiting').slice(0, 3);
  const committedToUs = portalEntries.filter(
    (e) => e.status === 'committed' && e.committedTeamId === userTeamId,
  );
  const availablePortal = portalEntries.filter((e) => e.status === 'available');
  const actionItems = computeActionItems({
    injuries,
    userTeam,
    scouting,
    recruitBoard,
    portalEntries,
    userTeamId,
    seasonComplete,
  });
  const highPriority = actionItems.filter((a) => a.priority === 'high');

  return (
    <div className="week-hub-layout">
      {/* ── Briefing header ─────────────────────────────── */}
      <div className="hub-header card">
        <div className="hub-header-info">
          <span className="section-label">
            {seasonComplete ? 'Season Complete' : `Week ${currentWeek} Briefing`}
          </span>
          <div className="hub-header-stats">
            <div className="hub-stat">
              <span className="hub-stat-value">
                {userTeam.record.wins}–{userTeam.record.losses}
              </span>
              <span className="hub-stat-label">Record</span>
            </div>
            {userRankEntry && (
              <div className="hub-stat">
                <span className="hub-stat-value hub-stat-rank">#{userRankEntry.rank}</span>
                <span className="hub-stat-label">National Rank</span>
              </div>
            )}
            {weeklyHub && (
              <div className="hub-stat">
                <span className="hub-stat-value hub-stat-prob">{weeklyHub.winProbability}%</span>
                <span className="hub-stat-label">Win Prob</span>
              </div>
            )}
            {weeklyHub && weeklyHub.recentForm.length > 0 && (
              <div className="hub-stat">
                <span className="hub-recent-form">
                  {weeklyHub.recentForm.map((r, i) => (
                    <span key={i} className={`hub-form-pip ${r === 'W' ? 'form-w' : 'form-l'}`}>
                      {r}
                    </span>
                  ))}
                </span>
                <span className="hub-stat-label">Recent Form</span>
              </div>
            )}
            <div className="hub-stat">
              <span className="hub-stat-value">{scouting.pointsAvailable}</span>
              <span className="hub-stat-label">Scout Pts</span>
            </div>
          </div>
        </div>
        {!seasonComplete && (
          <button className="hub-sim-btn" onClick={onSimWeek}>
            Sim Week {currentWeek} →
          </button>
        )}
      </div>

      {/* ── Alert banner for high-priority items ─────── */}
      {highPriority.length > 0 && (
        <div className="hub-alert-banner">
          {highPriority.map((item) => (
            <div key={item.id} className="hub-alert-row">
              <span>{item.icon}</span>
              <span>{item.text}</span>
              {item.nav && (
                <button className="hub-alert-link" onClick={() => onNavigate(item.nav!)}>
                  Go →
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Last Week Results ─────────────────────────── */}
      {lastSimWeek !== null && lastWeekGames.length > 0 && (
        <article className="card hub-results-card">
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
        </article>
      )}

      {/* ── Main grid ──────────────────────────────────── */}
      <div className="hub-grid">
        {/* Next Opponent */}
        <article className="card hub-card">
          <h3 className="hub-card-title">Next Opponent</h3>
          {weeklyHub ? (
            <>
              <div className="hub-matchup-opponent">
                {formatTeamName(weeklyHub.opponentName)}
              </div>
              <div className="hub-matchup-meta">
                {weeklyHub.preview.userIsHome ? 'Home' : 'Away'} · Week {weeklyHub.preview.game.week}
                {weeklyHub.opponentRank && (
                  <span className="hub-opp-rank"> · #{weeklyHub.opponentRank} nationally</span>
                )}
              </div>
              <div className="hub-opp-record">
                {weeklyHub.opponentRecord.wins}–{weeklyHub.opponentRecord.losses}
              </div>
              <p className="hub-matchup-note">{weeklyHub.preview.matchupNote}</p>
              <div className="hub-edges">
                {[
                  { label: 'OVR', val: weeklyHub.preview.ratingEdge },
                  { label: 'OFF', val: weeklyHub.preview.offenseEdge },
                  { label: 'DEF', val: weeklyHub.preview.defenseEdge },
                  { label: 'GK', val: weeklyHub.preview.goalieEdge },
                  { label: 'FO', val: weeklyHub.preview.faceoffEdge },
                ].map(({ label, val }) => (
                  <div key={label} className={`hub-edge ${val >= 0 ? 'edge-pos' : 'edge-neg'}`}>
                    <span className="hub-edge-label">{label}</span>
                    <span className="hub-edge-val">{val >= 0 ? '+' : ''}{val}</span>
                  </div>
                ))}
              </div>
              {weeklyHub.keyPlayers.length > 0 && (
                <div className="hub-key-players">
                  {weeklyHub.keyPlayers.map((kp) => (
                    <div key={kp.playerId} className={`hub-key-player ${kp.isUser ? 'kp-user' : 'kp-opp'}`}>
                      <span className="kp-name">{kp.name}</span>
                      <span className="kp-pos">{kp.position}</span>
                      <span className="kp-line">{kp.line}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="dim">No upcoming games scheduled.</p>
          )}
        </article>

        {/* Injury Report */}
        <article className="card hub-card">
          <h3 className="hub-card-title">
            Injury Report
            {injuries.length > 0 && <span className="hub-card-badge">{injuries.length}</span>}
          </h3>
          {injuries.length > 0 ? (
            <ul className="hub-injury-list">
              {injuries.map((inj) => {
                const player = userTeam.roster.find((p) => p.id === inj.playerId);
                if (!player) return null;
                return (
                  <li key={inj.playerId} className="hub-injury-row">
                    <div className="hub-injury-name">
                      {player.name.first} {player.name.last}
                      <span className="hub-injury-pos">{player.position}</span>
                    </div>
                    <div className="hub-injury-weeks">
                      Out {inj.weeksRemaining} wk{inj.weeksRemaining > 1 ? 's' : ''}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="dim hub-no-items">No injuries — full squad available.</p>
          )}
          <button className="hub-nav-link" onClick={() => onNavigate('team')}>
            Open Roster →
          </button>
        </article>

        {/* Recruiting Pulse */}
        <article className="card hub-card">
          <h3 className="hub-card-title">Recruiting Pulse</h3>
          <div className="hub-scout-bar">
            <span className="hub-scout-label">Scouting Points</span>
            <div className="hub-scout-track">
              <div
                className="hub-scout-fill"
                style={{
                  width: `${Math.min(100, (scouting.pointsAvailable / (scouting.pointsPerWeek * 4)) * 100)}%`,
                }}
              />
            </div>
            <span className="hub-scout-val">{scouting.pointsAvailable}</span>
          </div>
          {recentRecruitNews.length > 0 ? (
            <ul className="hub-news-list">
              {recentRecruitNews.map((item) => (
                <li key={item.id} className="hub-news-row">
                  <span className="hub-news-dot" />
                  <span className="hub-news-text">{item.headline}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dim hub-no-items">No recruiting news this week.</p>
          )}
          {recruitBoard.slice(0, 3).map((entry) => {
            const r = entry.recruit;
            const full = scouting.fullIds.includes(r.id);
            const partial = r.id in scouting.partialIds;
            return (
              <div key={r.id} className="hub-recruit-row">
                <div className="hub-recruit-name">
                  {r.name.first} {r.name.last}
                  <span className="hub-recruit-pos">{r.position}</span>
                </div>
                <span className={`hub-recruit-scout ${full ? 'scout-full' : partial ? 'scout-partial' : 'scout-none'}`}>
                  {full ? 'Full' : partial ? 'Partial' : 'Unscouted'}
                </span>
              </div>
            );
          })}
          <button className="hub-nav-link" onClick={() => onNavigate('recruiting')}>
            Open Board →
          </button>
        </article>

        {/* Transfer Portal */}
        <article className="card hub-card">
          <h3 className="hub-card-title">
            Transfer Portal
            {availablePortal.length > 0 && <span className="hub-card-badge">{availablePortal.length}</span>}
          </h3>
          {committedToUs.length > 0 && (
            <div className="hub-portal-committed">
              <p className="section-label">Committed to Us</p>
              <ul className="hub-portal-list">
                {committedToUs.map((e) => (
                  <li key={e.id} className="hub-portal-row hub-portal-committed-row">
                    <span>{e.name.first} {e.name.last}</span>
                    <span className="hub-portal-pos">{e.position}</span>
                    <span className="hub-portal-ovr">{e.ratings.overall} OVR</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {availablePortal.length > 0 ? (
            <>
              <p className="section-label" style={{ marginTop: committedToUs.length > 0 ? 12 : 0 }}>
                Available
              </p>
              <ul className="hub-portal-list">
                {availablePortal.slice(0, 4).map((e) => {
                  const hasOffer = !!e.offersByTeamId[userTeamId];
                  return (
                    <li key={e.id} className="hub-portal-row">
                      <span>{e.name.first} {e.name.last}</span>
                      <span className="hub-portal-pos">{e.position}</span>
                      <span className="hub-portal-ovr">{e.ratings.overall} OVR</span>
                      {hasOffer && <span className="hub-portal-offered">Offered</span>}
                    </li>
                  );
                })}
                {availablePortal.length > 4 && (
                  <li className="hub-portal-more">+{availablePortal.length - 4} more</li>
                )}
              </ul>
            </>
          ) : (
            <p className="dim hub-no-items">No players in the portal.</p>
          )}
          <button className="hub-nav-link" onClick={() => onNavigate('recruiting')}>
            Open Portal →
          </button>
        </article>
      </div>

      {/* ── Action Items ──────────────────────────────── */}
      <article className="card hub-actions-card">
        <h3 className="hub-card-title">Recommended Actions</h3>
        <ul className="hub-actions-list">
          {actionItems.map((item) => (
            <li key={item.id} className={`hub-action-row hub-action-${item.priority}`}>
              <span className="hub-action-icon">{item.icon}</span>
              <span className="hub-action-text">{item.text}</span>
              {item.nav && (
                <button className="hub-action-nav" onClick={() => onNavigate(item.nav!)}>
                  Go →
                </button>
              )}
            </li>
          ))}
        </ul>
      </article>
    </div>
  );
}
