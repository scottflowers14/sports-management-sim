import { useState } from 'react';
import type { LacrossePlayerTraits, LacrossePortalEntry, LacrossePosition } from '@sports-management-sim/sport-lacrosse';
import { topRecruitMotivations, type RecruitBoardEntry, type RecruitMotivation } from '@sports-management-sim/engine-core';
import type { ScoutingState } from '../scouting';
import { getDisplayOvr, getScoutTier } from '../scouting';
import { formatTeamName, formatTeamShort } from '../ui/format';

type LacrosseBoardEntry = RecruitBoardEntry<LacrossePosition, LacrossePlayerTraits>;

export type RecruitBoardView = 'shortlist' | 'all';
type BoardSort = 'rank' | 'stars' | 'ovr' | 'interest';

/** 4★+ recruits are nationally ranked — their star tier is public knowledge. */
const PUBLIC_STAR_FLOOR = 4;

const MOTIVATION_LABELS: Record<RecruitMotivation, string> = {
  proximity: 'Close to Home',
  prestige: 'Big Stage',
  scholarship: 'Scholarship $',
  playingTime: 'Playing Time',
  academics: 'Academics',
};

function starsArePublic(entry: LacrosseBoardEntry): boolean {
  return entry.recruit.starRating >= PUBLIC_STAR_FLOOR;
}

/** Motivations revealed so far: partial scouting shows the top one, full shows two. */
function revealedMotivations(entry: LacrosseBoardEntry, tier: 'none' | 'partial' | 'full'): RecruitMotivation[] {
  if (tier === 'none') return [];
  return topRecruitMotivations(entry.recruit.preferences, tier === 'full' ? 2 : 1);
}

export function RecruitingScreen({
  recruitBoard,
  portalEntries,
  scouting,
  userTeamId,
  teamMap,
  currentWeek,
  recruitPosFilter,
  recruitTab,
  shortlistIds,
  boardView,
  scholarshipBudget,
  onOfferScholarship,
  onScoutRecruit,
  onOfferPortalPlayer,
  onRecruitPosFilterChange,
  onRecruitTabChange,
  onToggleShortlist,
  onBoardViewChange,
  onSelectRecruit,
}: {
  recruitBoard: LacrosseBoardEntry[];
  portalEntries: LacrossePortalEntry[];
  scouting: ScoutingState;
  userTeamId: string;
  teamMap: Map<string, string>;
  currentWeek: number;
  recruitPosFilter: LacrossePosition | 'ALL';
  recruitTab: 'board' | 'portal';
  shortlistIds: string[];
  boardView: RecruitBoardView;
  scholarshipBudget: { used: number; total: number };
  onOfferScholarship: (recruitId: string, scholarshipPercent: number) => void;
  onScoutRecruit: (recruitId: string, trueOvr: number) => void;
  onOfferPortalPlayer: (entryId: string) => void;
  onRecruitPosFilterChange: (pos: LacrossePosition | 'ALL') => void;
  onRecruitTabChange: (tab: 'board' | 'portal') => void;
  onToggleShortlist: (recruitId: string) => void;
  onBoardViewChange: (view: RecruitBoardView) => void;
  onSelectRecruit: (recruitId: string) => void;
}) {
  const [boardSort, setBoardSort] = useState<BoardSort>('rank');
  const [hideCommitted, setHideCommitted] = useState(false);

  const shortlistSet = new Set(shortlistIds);
  const isOurs = (entry: LacrosseBoardEntry) =>
    entry.recruit.committedTeamId === userTeamId || entry.recruit.signedTeamId === userTeamId;
  const boardEntries = recruitBoard.filter((e) => shortlistSet.has(e.recruit.id) || isOurs(e));

  const matchesPosFilter = (entry: LacrosseBoardEntry) =>
    recruitPosFilter === 'ALL' || entry.recruit.position === recruitPosFilter;

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
          <div className="board-subnav">
            <div className="board-subnav-left">
              <div className="recruit-tabs board-view-tabs">
                <button
                  className={`recruit-tab${boardView === 'shortlist' ? ' active' : ''}`}
                  onClick={() => onBoardViewChange('shortlist')}
                >
                  My Board
                  {boardEntries.length > 0 && <span className="board-count-badge">{boardEntries.length}</span>}
                </button>
                <button
                  className={`recruit-tab${boardView === 'all' ? ' active' : ''}`}
                  onClick={() => onBoardViewChange('all')}
                >
                  All Recruits
                </button>
              </div>
              <span
                className={`budget-chip${scholarshipBudget.total - scholarshipBudget.used < 0.25 ? ' budget-low' : ''}`}
                title="Scholarship equivalencies available for this class. Offers count against the budget; money offered to recruits who sign elsewhere is released."
              >
                Scholarships {scholarshipBudget.used.toFixed(2)} / {scholarshipBudget.total.toFixed(2)}
              </span>
            </div>

            {boardView === 'all' && (
              <div className="board-controls">
                <label className="board-sort-label">
                  Sort
                  <select
                    aria-label="Sort recruits"
                    value={boardSort}
                    onChange={(e) => setBoardSort(e.target.value as BoardSort)}
                  >
                    <option value="rank">Best for Us</option>
                    <option value="stars">Stars</option>
                    <option value="ovr">Scouted OVR</option>
                    <option value="interest">Interest</option>
                  </select>
                </label>
                <label className="board-hide-committed">
                  <input
                    type="checkbox"
                    checked={hideCommitted}
                    onChange={(e) => setHideCommitted(e.target.checked)}
                  />
                  Hide committed
                </label>
              </div>
            )}
          </div>

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

          {boardView === 'shortlist' ? (
            <ShortlistBoard
              entries={boardEntries.filter(matchesPosFilter)}
              totalOnBoard={boardEntries.length}
              scouting={scouting}
              userTeamId={userTeamId}
              teamMap={teamMap}
              currentWeek={currentWeek}
              shortlistSet={shortlistSet}
              budgetRemaining={scholarshipBudget.total - scholarshipBudget.used}
              onOfferScholarship={onOfferScholarship}
              onScoutRecruit={onScoutRecruit}
              onToggleShortlist={onToggleShortlist}
              onSelectRecruit={onSelectRecruit}
              onBrowseAll={() => onBoardViewChange('all')}
            />
          ) : (
            <AllRecruitsList
              entries={recruitBoard.filter(matchesPosFilter)}
              sort={boardSort}
              hideCommitted={hideCommitted}
              scouting={scouting}
              userTeamId={userTeamId}
              teamMap={teamMap}
              shortlistSet={shortlistSet}
              budgetRemaining={scholarshipBudget.total - scholarshipBudget.used}
              onOfferScholarship={onOfferScholarship}
              onScoutRecruit={onScoutRecruit}
              onToggleShortlist={onToggleShortlist}
              onSelectRecruit={onSelectRecruit}
            />
          )}
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

function ShortlistBoard({
  entries,
  totalOnBoard,
  scouting,
  userTeamId,
  teamMap,
  currentWeek,
  shortlistSet,
  budgetRemaining,
  onOfferScholarship,
  onScoutRecruit,
  onToggleShortlist,
  onSelectRecruit,
  onBrowseAll,
}: {
  entries: LacrosseBoardEntry[];
  totalOnBoard: number;
  scouting: ScoutingState;
  userTeamId: string;
  teamMap: Map<string, string>;
  currentWeek: number;
  shortlistSet: Set<string>;
  budgetRemaining: number;
  onOfferScholarship: (recruitId: string, scholarshipPercent: number) => void;
  onScoutRecruit: (recruitId: string, trueOvr: number) => void;
  onToggleShortlist: (recruitId: string) => void;
  onSelectRecruit: (recruitId: string) => void;
  onBrowseAll: () => void;
}) {
  if (totalOnBoard === 0) {
    return (
      <article className="card board-empty-card">
        <h2>Your board is empty</h2>
        <p className="dim">
          Pin recruits from the national pool to track them here. Offering a scholarship adds a
          recruit to your board automatically.
        </p>
        <button className="offer-btn board-browse-btn" onClick={onBrowseAll}>
          Browse All Recruits
        </button>
      </article>
    );
  }

  const offersOut = entries.filter(
    (e) => e.recruit.status === 'open' && e.recruit.scholarshipOffers.some((o) => o.teamId === userTeamId),
  ).length;
  const committed = entries.filter((e) => e.recruit.committedTeamId === userTeamId && e.recruit.status === 'committed').length;
  const signed = entries.filter((e) => e.recruit.signedTeamId === userTeamId).length;
  const lost = entries.filter(
    (e) =>
      e.recruit.status !== 'open' &&
      e.recruit.committedTeamId !== userTeamId &&
      e.recruit.signedTeamId !== userTeamId,
  ).length;

  return (
    <>
      <div className="board-summary">
        <span className="board-summary-chip">{entries.length} on board</span>
        <span className="board-summary-chip chip-offers">{offersOut} offers out</span>
        <span className="board-summary-chip chip-commits">{committed} committed</span>
        <span className="board-summary-chip chip-signed">{signed} signed</span>
        {lost > 0 && <span className="board-summary-chip chip-lost">{lost} lost</span>}
      </div>
      <div className="recruit-grid">
        {entries.map((entry) => (
          <RecruitCard
            key={entry.recruit.id}
            entry={entry}
            scouting={scouting}
            userTeamId={userTeamId}
            teamMap={teamMap}
            currentWeek={currentWeek}
            pinned={shortlistSet.has(entry.recruit.id)}
            budgetRemaining={budgetRemaining}
            onOfferScholarship={onOfferScholarship}
            onScoutRecruit={onScoutRecruit}
            onToggleShortlist={onToggleShortlist}
            onSelectRecruit={onSelectRecruit}
          />
        ))}
      </div>
    </>
  );
}

function AllRecruitsList({
  entries,
  sort,
  hideCommitted,
  scouting,
  userTeamId,
  teamMap,
  shortlistSet,
  budgetRemaining,
  onOfferScholarship,
  onScoutRecruit,
  onToggleShortlist,
  onSelectRecruit,
}: {
  entries: LacrosseBoardEntry[];
  sort: BoardSort;
  hideCommitted: boolean;
  scouting: ScoutingState;
  userTeamId: string;
  teamMap: Map<string, string>;
  shortlistSet: Set<string>;
  budgetRemaining: number;
  onOfferScholarship: (recruitId: string, scholarshipPercent: number) => void;
  onScoutRecruit: (recruitId: string, trueOvr: number) => void;
  onToggleShortlist: (recruitId: string) => void;
  onSelectRecruit: (recruitId: string) => void;
}) {
  const visible = hideCommitted
    ? entries.filter(
        (e) =>
          e.recruit.status === 'open' ||
          e.recruit.committedTeamId === userTeamId ||
          e.recruit.signedTeamId === userTeamId,
      )
    : entries;

  // Sort only on information the user can see: unscouted recruits sink to the bottom
  // for stars/OVR sorts instead of leaking their true ratings.
  const sortValue = (entry: LacrosseBoardEntry): number => {
    const { recruit } = entry;
    const tier = getScoutTier(recruit.id, scouting);
    switch (sort) {
      case 'stars':
        return tier === 'none' && !starsArePublic(entry) ? -1 : recruit.starRating;
      case 'ovr':
        return getDisplayOvr(recruit.id, recruit.ratings.overall, scouting) ?? -1;
      case 'interest':
        return recruit.interestByTeamId[userTeamId] ?? 0;
      case 'rank':
        return 0;
    }
  };

  const sorted =
    sort === 'rank'
      ? visible
      : visible
          .map((entry, index) => ({ entry, index }))
          .sort((a, b) => sortValue(b.entry) - sortValue(a.entry) || a.index - b.index)
          .map(({ entry }) => entry);

  return (
    <div className="recruit-list">
      {sorted.map((entry) => {
        const { recruit } = entry;
        const tier = getScoutTier(recruit.id, scouting);
        const displayOvr = getDisplayOvr(recruit.id, recruit.ratings.overall, scouting);
        const userInterest = recruit.interestByTeamId[userTeamId] ?? 0;
        const hasOffer = recruit.scholarshipOffers.some((o) => o.teamId === userTeamId);
        const isCommittedToUs =
          recruit.committedTeamId === userTeamId || recruit.signedTeamId === userTeamId;
        const isCommittedElsewhere = recruit.status !== 'open' && !isCommittedToUs;
        const pinned = shortlistSet.has(recruit.id);
        const fullName = `${recruit.name.first} ${recruit.name.last}`;
        const showStars = tier !== 'none' || starsArePublic(entry);
        const motivations = revealedMotivations(entry, tier);

        return (
          <div
            key={recruit.id}
            className={`recruit-row${isCommittedElsewhere ? ' row-committed-elsewhere' : ''}${pinned ? ' row-pinned' : ''}`}
          >
            <button
              className={`pin-btn${pinned ? ' pinned' : ''}`}
              aria-label={pinned ? `Remove ${fullName} from board` : `Add ${fullName} to board`}
              title={pinned ? 'Remove from board' : 'Add to board'}
              onClick={() => onToggleShortlist(recruit.id)}
            >
              {pinned ? '★' : '☆'}
            </button>

            <div className="recruit-row-main">
              <button className="recruit-name-btn" onClick={() => onSelectRecruit(recruit.id)} title={`View ${fullName}`}>
                {fullName}
                {starsArePublic(entry) && <span className="top100-chip">Top 100</span>}
              </button>
              <span className="recruit-row-meta">
                {recruit.position} ·{' '}
                {showStars ? (
                  <span className="row-stars">{'★'.repeat(recruit.starRating)}</span>
                ) : (
                  <span className="hidden-stat">? stars</span>
                )}{' '}
                · {recruit.hometown}
                {motivations.map((m) => (
                  <span key={m} className="motive-chip">{MOTIVATION_LABELS[m]}</span>
                ))}
              </span>
            </div>

            <div className="recruit-row-ovr">
              {displayOvr !== null ? (
                <span className={`board-score${tier === 'partial' ? ' fuzzy-ovr' : ''}`}>
                  {displayOvr}
                  {tier === 'partial' && <span className="fuzzy-tilde">~</span>}
                </span>
              ) : (
                <span className="board-score hidden-stat">??</span>
              )}
            </div>

            <div className="recruit-row-status">
              {isCommittedToUs ? (
                <span className={`badge badge-${recruit.status}`}>
                  {recruit.status === 'committed' ? 'Committed' : 'Signed'}
                </span>
              ) : isCommittedElsewhere ? (
                <span className="badge badge-elsewhere">
                  → {formatTeamShort(teamMap.get(recruit.committedTeamId ?? recruit.signedTeamId ?? '') ?? 'Other')}
                </span>
              ) : hasOffer ? (
                <span className="row-interest">Interest {userInterest}</span>
              ) : (
                <span className="row-interest dim-interest">—</span>
              )}
            </div>

            <div className="recruit-row-actions">
              {!isCommittedToUs && !isCommittedElsewhere && (
                <>
                  {tier !== 'full' && (
                    <button
                      className="scout-btn scout-btn-row"
                      onClick={() => onScoutRecruit(recruit.id, recruit.ratings.overall)}
                      disabled={scouting.pointsAvailable <= 0}
                    >
                      {tier === 'partial' ? 'Full Scout (1 pt)' : 'Scout (1 pt)'}
                    </button>
                  )}
                  {tier !== 'none' && !hasOffer && (
                    <OfferControl
                      recruitId={recruit.id}
                      recruitName={fullName}
                      budgetRemaining={budgetRemaining}
                      onOffer={onOfferScholarship}
                    />
                  )}
                  {hasOffer && (
                    <span className="badge badge-offered">
                      Offered {recruit.scholarshipOffers.find((o) => o.teamId === userTeamId)?.scholarshipPercent}%
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
      {sorted.length === 0 && (
        <article className="card">
          <p className="dim">No recruits match the current filters.</p>
        </article>
      )}
    </div>
  );
}

function RecruitCard({
  entry,
  scouting,
  userTeamId,
  teamMap,
  currentWeek,
  pinned,
  budgetRemaining,
  onOfferScholarship,
  onScoutRecruit,
  onToggleShortlist,
  onSelectRecruit,
}: {
  entry: LacrosseBoardEntry;
  scouting: ScoutingState;
  userTeamId: string;
  teamMap: Map<string, string>;
  currentWeek: number;
  pinned: boolean;
  budgetRemaining: number;
  onOfferScholarship: (recruitId: string, scholarshipPercent: number) => void;
  onScoutRecruit: (recruitId: string, trueOvr: number) => void;
  onToggleShortlist: (recruitId: string) => void;
  onSelectRecruit: (recruitId: string) => void;
}) {
  const { recruit } = entry;
  const tier = getScoutTier(recruit.id, scouting);
  const displayOvr = getDisplayOvr(recruit.id, recruit.ratings.overall, scouting);
  const userInterest = recruit.interestByTeamId[userTeamId] ?? 0;
  const userOffer = recruit.scholarshipOffers.find((o) => o.teamId === userTeamId);
  const hasOffer = userOffer !== undefined;
  const isCommittedToUs =
    recruit.committedTeamId === userTeamId || recruit.signedTeamId === userTeamId;
  const isCommittedElsewhere = recruit.status !== 'open' && !isCommittedToUs;
  const fullName = `${recruit.name.first} ${recruit.name.last}`;
  const showStars = tier !== 'none' || starsArePublic(entry);
  const motivations = revealedMotivations(entry, tier);

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
      className={`card recruit-card${isCommittedToUs ? ' committed-to-us' : ''}${tier === 'none' ? ' unscouted' : ''}`}
    >
      <div className="recruit-header">
        <div>
          <button className="recruit-name-btn" onClick={() => onSelectRecruit(recruit.id)} title={`View ${fullName}`}>
            {fullName}
            {starsArePublic(entry) && <span className="top100-chip">Top 100</span>}
          </button>
          <p className="recruit-sub">
            {recruit.position} ·{' '}
            {showStars ? (
              <>
                {'★'.repeat(recruit.starRating)}{'☆'.repeat(5 - recruit.starRating)}
              </>
            ) : (
              <span className="hidden-stat">? stars</span>
            )}
          </p>
        </div>
        <div className="recruit-header-side">
          {!isCommittedToUs && (
            <button
              className={`pin-btn${pinned ? ' pinned' : ''}`}
              aria-label={pinned ? `Remove ${fullName} from board` : `Add ${fullName} to board`}
              title={pinned ? 'Remove from board' : 'Add to board'}
              onClick={() => onToggleShortlist(recruit.id)}
            >
              {pinned ? '★' : '☆'}
            </button>
          )}
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
      </div>

      {motivations.length > 0 && (
        <div className="motive-row">
          {motivations.map((m) => (
            <span key={m} className="motive-chip">{MOTIVATION_LABELS[m]}</span>
          ))}
        </div>
      )}

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
            {!hasOffer && (
              <OfferControl
                recruitId={recruit.id}
                recruitName={fullName}
                budgetRemaining={budgetRemaining}
                onOffer={onOfferScholarship}
              />
            )}
            {hasOffer && <span className="badge badge-offered">Offered {userOffer.scholarshipPercent}%</span>}
            <button
              className="scout-btn scout-btn-sm"
              onClick={() => onScoutRecruit(recruit.id, recruit.ratings.overall)}
              disabled={scouting.pointsAvailable <= 0}
            >
              Full Scout (1 pt)
            </button>
          </div>
        ) : hasOffer ? (
          <span className="badge badge-offered">Offered {userOffer.scholarshipPercent}%</span>
        ) : (
          <OfferControl
            recruitId={recruit.id}
            recruitName={fullName}
            budgetRemaining={budgetRemaining}
            onOffer={onOfferScholarship}
          />
        )}
      </div>
    </article>
  );
}

const OFFER_PERCENT_OPTIONS = [25, 50, 75, 100] as const;

function OfferControl({
  recruitId,
  recruitName,
  budgetRemaining,
  onOffer,
}: {
  recruitId: string;
  recruitName: string;
  budgetRemaining: number;
  onOffer: (recruitId: string, scholarshipPercent: number) => void;
}) {
  const affordable = OFFER_PERCENT_OPTIONS.filter((pct) => pct / 100 <= budgetRemaining + 1e-9);
  const maxAffordable = affordable[affordable.length - 1];
  const [percent, setPercent] = useState<number>(maxAffordable ?? 100);
  const canAfford = percent / 100 <= budgetRemaining + 1e-9;

  return (
    <div className="offer-control">
      <select
        aria-label={`Scholarship offer amount for ${recruitName}`}
        className="offer-pct-select"
        value={percent}
        onChange={(e) => setPercent(Number(e.target.value))}
      >
        {OFFER_PERCENT_OPTIONS.map((pct) => (
          <option key={pct} value={pct} disabled={pct / 100 > budgetRemaining + 1e-9}>
            {pct}%
          </option>
        ))}
      </select>
      <button
        className="offer-btn offer-btn-sm offer-btn-row"
        disabled={!canAfford}
        title={canAfford ? `Offer a ${percent}% scholarship` : 'Not enough scholarship budget'}
        onClick={() => {
          if (
            percent === 100 &&
            !window.confirm(`Offer ${recruitName} a full scholarship (100%)? This uses a full equivalency from your budget.`)
          ) {
            return;
          }
          onOffer(recruitId, percent);
        }}
      >
        Offer
      </button>
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
