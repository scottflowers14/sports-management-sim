import type { LacrossePlayerTraits, LacrossePortalEntry, LacrossePosition } from '@sports-management-sim/sport-lacrosse';
import type { RecruitBoardEntry } from '@sports-management-sim/engine-core';
import type { ScoutingState } from '../scouting';
import { getDisplayOvr, getScoutTier } from '../scouting';
import { formatTeamName, formatTeamShort } from '../ui/format';

export function RecruitingScreen({
  recruitBoard,
  portalEntries,
  scouting,
  userTeamId,
  teamMap,
  currentWeek,
  recruitPosFilter,
  recruitTab,
  onOfferScholarship,
  onScoutRecruit,
  onOfferPortalPlayer,
  onRecruitPosFilterChange,
  onRecruitTabChange,
}: {
  recruitBoard: RecruitBoardEntry<LacrossePosition, LacrossePlayerTraits>[];
  portalEntries: LacrossePortalEntry[];
  scouting: ScoutingState;
  userTeamId: string;
  teamMap: Map<string, string>;
  currentWeek: number;
  recruitPosFilter: LacrossePosition | 'ALL';
  recruitTab: 'board' | 'portal';
  onOfferScholarship: (recruitId: string) => void;
  onScoutRecruit: (recruitId: string, trueOvr: number) => void;
  onOfferPortalPlayer: (entryId: string) => void;
  onRecruitPosFilterChange: (pos: LacrossePosition | 'ALL') => void;
  onRecruitTabChange: (tab: 'board' | 'portal') => void;
}) {

  return (
    <div className="recruit-layout">
      <div className="recruit-top-bar">
        <div className="recruit-tabs">
          <button
            className={`recruit-tab${recruitTab === 'board' ? ' active' : ''}`}
            onClick={() => onRecruitTabChange('board')}
          >
            Recruit Board
          </button>
          <button
            className={`recruit-tab${recruitTab === 'portal' ? ' active' : ''}`}
            onClick={() => onRecruitTabChange('portal')}
          >
            Transfer Portal
            {portalEntries.filter((e) => e.status === 'available').length > 0 && (
              <span className="portal-badge">
                {portalEntries.filter((e) => e.status === 'available').length}
              </span>
            )}
          </button>
        </div>

        {recruitTab === 'board' && (
          <div className="scout-header-inline">
            <span className="scout-pts-num">{scouting.pointsAvailable}</span>
            <span className="scout-pts-label">Scouting Points</span>
            <span className="scout-pts-hint">(+{scouting.pointsPerWeek}/wk)</span>
          </div>
        )}
      </div>

      {recruitTab === 'board' && (
        <>
          <div className="pos-filter-bar">
            {(['ALL', 'ATT', 'MID', 'DEF', 'GK', 'FOGO', 'LSM'] as const).map((pos) => (
              <button
                key={pos}
                className={`pos-filter-btn${recruitPosFilter === pos ? ' active' : ''}`}
                onClick={() => onRecruitPosFilterChange(pos)}
              >
                {pos}
              </button>
            ))}
          </div>

          <div className="recruit-grid">
            {recruitBoard
              .filter((e) => recruitPosFilter === 'ALL' || e.recruit.position === recruitPosFilter)
              .slice(0, 30)
              .map((entry) => {
                const { recruit } = entry;
                const tier = getScoutTier(recruit.id, scouting);
                const displayOvr = getDisplayOvr(recruit.id, recruit.ratings.overall, scouting);
                const userInterest = recruit.interestByTeamId[userTeamId] ?? 0;
                const hasOffer = recruit.scholarshipOffers.some((o) => o.teamId === userTeamId);
                const isCommittedToUs =
                  recruit.committedTeamId === userTeamId ||
                  recruit.signedTeamId === userTeamId;
                const isCommittedElsewhere = recruit.status !== 'open' && !isCommittedToUs;

                const competitors = recruit.scholarshipOffers
                  .filter((o) => o.teamId !== userTeamId)
                  .map((o) => ({
                    teamId: o.teamId,
                    name: formatTeamShort(teamMap.get(o.teamId) ?? o.teamId),
                    interest: recruit.interestByTeamId[o.teamId] ?? 0,
                  }))
                  .sort((a, b) => b.interest - a.interest)
                  .slice(0, 3);

                const commitThreshold = Math.min(84, Math.max(58, 84 - currentWeek * 5 + recruit.starRating));
                const commitPct = hasOffer ? Math.min(100, Math.round((userInterest / commitThreshold) * 100)) : 0;

                return (
                  <article
                    key={recruit.id}
                    className={`card recruit-card${isCommittedToUs ? ' committed-to-us' : ''}${tier === 'none' ? ' unscouted' : ''}`}
                  >
                    <div className="recruit-header">
                      <div>
                        <strong>
                          {recruit.name.first} {recruit.name.last}
                        </strong>
                        <p className="recruit-sub">
                          {recruit.position} ·{' '}
                          {tier !== 'none' ? (
                            <>
                              {'★'.repeat(recruit.starRating)}{'☆'.repeat(5 - recruit.starRating)}
                            </>
                          ) : (
                            <span className="hidden-stat">? stars</span>
                          )}
                        </p>
                      </div>
                      <div className="recruit-ovr-block">
                        {displayOvr !== null ? (
                          <span className={`board-score${tier === 'partial' ? ' fuzzy-ovr' : ''}`}>
                            {displayOvr}
                            {tier === 'partial' && <span className="fuzzy-tilde">~</span>}
                          </span>
                        ) : (
                          <span className="board-score hidden-stat">??</span>
                        )}
                        <span className="recruit-score-label">OVR</span>
                      </div>
                    </div>

                    {tier !== 'none' && hasOffer && (
                      <>
                        <div className="interest-bar-wrap">
                          <div className="interest-bar" style={{ width: `${userInterest}%` }} />
                        </div>
                        <div className="recruit-interest-row">
                          <span className="interest-label">Interest {userInterest}/100</span>
                          <span className={`commit-pct${commitPct >= 80 ? ' hot' : commitPct >= 50 ? ' warm' : ''}`}>
                            {commitPct}% commit
                          </span>
                        </div>
                      </>
                    )}

                    {competitors.length > 0 && !isCommittedToUs && !isCommittedElsewhere && (
                      <div className="competitor-row">
                        {competitors.map((c) => (
                          <span key={c.teamId} className="competitor-chip" title={`${c.name} — ${c.interest} interest`}>
                            {c.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="recruit-footer">
                      {isCommittedToUs ? (
                        <span className={`badge badge-${recruit.status}`}>
                          {recruit.status === 'committed' ? 'Committed' : 'Signed'}
                        </span>
                      ) : isCommittedElsewhere ? (
                        <span className="badge badge-elsewhere">
                          → {formatTeamName(teamMap.get(recruit.committedTeamId ?? recruit.signedTeamId ?? '') ?? 'Other')}
                        </span>
                      ) : tier === 'none' ? (
                        <button
                          className="scout-btn"
                          onClick={() => onScoutRecruit(recruit.id, recruit.ratings.overall)}
                          disabled={scouting.pointsAvailable <= 0}
                        >
                          Scout (1 pt)
                        </button>
                      ) : tier === 'partial' ? (
                        <div className="recruit-footer-row">
                          <button
                            className="scout-btn scout-btn-sm"
                            onClick={() => onScoutRecruit(recruit.id, recruit.ratings.overall)}
                            disabled={scouting.pointsAvailable <= 0}
                          >
                            Full Scout (1 pt)
                          </button>
                          {!hasOffer && (
                            <button className="offer-btn" onClick={() => onOfferScholarship(recruit.id)}>
                              Offer
                            </button>
                          )}
                          {hasOffer && <span className="badge badge-offered">Offered</span>}
                        </div>
                      ) : hasOffer ? (
                        <span className="badge badge-offered">Offered</span>
                      ) : (
                        <button className="offer-btn" onClick={() => onOfferScholarship(recruit.id)}>
                          Offer Scholarship
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
          </div>
        </>
      )}

      {recruitTab === 'portal' && (
        <PortalBoard
          entries={portalEntries}
          userTeamId={userTeamId}
          teamMap={teamMap}
          onOffer={onOfferPortalPlayer}
        />
      )}
    </div>
  );
}

function PortalBoard({
  entries,
  userTeamId,
  teamMap,
  onOffer,
}: {
  entries: LacrossePortalEntry[];
  userTeamId: string;
  teamMap: Map<string, string>;
  onOffer: (id: string) => void;
}) {
  const available = entries.filter((e) => e.status === 'available');
  const committed = entries.filter((e) => e.status === 'committed' && e.committedTeamId === userTeamId);

  if (entries.length === 0) {
    return (
      <article className="card">
        <h2>Transfer Portal</h2>
        <p className="dim">Portal opens at the start of each new season. Check back after the offseason.</p>
      </article>
    );
  }

  return (
    <div className="portal-layout">
      {committed.length > 0 && (
        <article className="card portal-committed-card">
          <h2>Committed Transfers · {committed.length}</h2>
          <ul className="player-list">
            {committed.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.name.first} {entry.name.last}</strong>
                <span>{entry.classYear} {entry.position} · {entry.ratings.overall} OVR · from {formatTeamName(teamMap.get(entry.sourceTeamId) ?? entry.sourceTeamId)}</span>
              </li>
            ))}
          </ul>
        </article>
      )}

      <div className="recruit-grid">
        {available.map((entry) => {
          const hasOffer = entry.offersByTeamId[userTeamId] !== undefined;
          const userInterest = entry.interestByTeamId[userTeamId] ?? 0;
          const competitors = Object.entries(entry.offersByTeamId)
            .filter(([tid]) => tid !== userTeamId)
            .map(([tid]) => ({ teamId: tid, name: formatTeamShort(teamMap.get(tid) ?? tid) }))
            .slice(0, 3);

          return (
            <article key={entry.id} className={`card recruit-card portal-entry-card${hasOffer ? ' has-offer' : ''}`}>
              <div className="recruit-header">
                <div>
                  <strong>{entry.name.first} {entry.name.last}</strong>
                  <p className="recruit-sub">{entry.classYear} {entry.position} · from {formatTeamShort(teamMap.get(entry.sourceTeamId) ?? entry.sourceTeamId)}</p>
                </div>
                <div className="recruit-ovr-block">
                  <span className="board-score">{entry.ratings.overall}</span>
                  <span className="recruit-score-label">OVR</span>
                </div>
              </div>

              {hasOffer && userInterest > 0 && (
                <>
                  <div className="interest-bar-wrap">
                    <div className="interest-bar" style={{ width: `${userInterest}%` }} />
                  </div>
                  <p className="interest-label">Interest {userInterest}/100</p>
                </>
              )}

              {competitors.length > 0 && (
                <div className="competitor-row">
                  {competitors.map((c) => (
                    <span key={c.teamId} className="competitor-chip">{c.name}</span>
                  ))}
                </div>
              )}

              <div className="recruit-footer">
                {hasOffer ? (
                  <span className="badge badge-offered">Offered</span>
                ) : (
                  <button className="offer-btn" onClick={() => onOffer(entry.id)}>
                    Offer Scholarship
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
