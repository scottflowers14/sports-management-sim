import { createContext, useContext, useState, type ReactNode } from 'react';
import type { PipelineRow } from '../pipelines';
import { OfferControl } from '../components/OfferControl';
import { PortalBoard, type PortalNilProps } from './PortalBoard';
import type { LacrossePlayerTraits, LacrossePortalEntry, LacrossePosition, LacrosseTeam } from '@sports-management-sim/sport-lacrosse';
import type { PositionNeed } from '@sports-management-sim/engine-core';
import {
  finalistTeamIds,
  isFinalistPhase,
  recruitDecisionWeek,
  topRecruitMotivations,
  type RecruitBoardEntry,
  type RecruitMotivation,
} from '@sports-management-sim/engine-core';
import type { ScoutingState } from '../scouting';
import { getDisplayOvr, getScoutTier, HOURS_COST } from '../scouting';
import type { RecruitingActivity } from '../recruiting-activity';
import type { AssistantReport as AssistantReportData } from '../recruiting-assistant';
import { formatTeamName, formatTeamShort } from '../ui/format';
import { attainableBoardScore, type LandChance } from '../recruit-odds';
import { LandChip } from '../components/LandChip';

type LacrosseBoardEntry = RecruitBoardEntry<LacrossePosition, LacrossePlayerTraits>;

export type RecruitBoardView = 'shortlist' | 'all';

/** Chance to land each open recruit, keyed by id (see recruit-odds.ts). */
const LandChanceContext = createContext<Map<string, LandChance> | undefined>(undefined);

/** What the recruiting staff does on its own each week. */
export type StaffMode = 'off' | 'pitch' | 'full';

export function staffModeOf(autoAssistant: boolean, autoOffers: boolean): StaffMode {
  return !autoAssistant ? 'off' : autoOffers ? 'full' : 'pitch';
}
type BoardSort = 'rank' | 'stars' | 'ovr' | 'interest';

/** 4★+ recruits are nationally ranked — their star tier is public knowledge. */
const PUBLIC_STAR_FLOOR = 4;

/** All Recruits shows this many rows per page; the full board runs to hundreds. */
export const RECRUITS_PAGE_SIZE = 25;

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

/** The user's recruiting pipelines by region, for the recruit rows' chips. */
const PipelineContext = createContext<Map<string, PipelineRow>>(new Map());

function PipelineChip({ regionId }: { regionId: string }) {
  const row = useContext(PipelineContext).get(regionId);
  if (!row || row.tier === 0) return null;
  return (
    <span className="pipeline-chip" title={`${row.count} of our players came from ${row.name}: recruits there treat us closer to home`}>
      Pipeline {'★'.repeat(row.tier)}
    </span>
  );
}

function PipelinesBar({ pipelines }: { pipelines: PipelineRow[] }) {
  return (
    <div className="pipelines-bar" aria-label="Recruiting pipelines">
      <span className="section-label">Pipelines</span>
      {pipelines.length === 0 ? (
        <span className="dim">None yet. Sign two scholarship players from one region outside your own to open a pipeline.</span>
      ) : (
        pipelines.map((p) => (
          <span key={p.regionId} className={`pipeline-pill${p.tier === 0 ? ' pipeline-pill-building' : ''}`} title={`${p.count} recruited players on the roster`}>
            {p.name} {p.tier > 0 ? '★'.repeat(p.tier) : '(1 signee away)'}
          </span>
        ))
      )}
    </div>
  );
}

function TrendArrow({ delta }: { delta: number | undefined }) {
  if (delta === undefined || delta === 0) return null;
  return (
    <span
      className={`trend-arrow ${delta > 0 ? 'trend-up' : 'trend-down'}`}
      title={`Interest ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)} last week`}
    >
      {delta > 0 ? '▲' : '▼'}{Math.abs(delta)}
    </span>
  );
}

/** Where a recruit is in their decision timeline, plus how the user stacks up. */
function DecisionChip({
  entry,
  currentWeek,
  finalWeek,
  userTeamId,
}: {
  entry: LacrosseBoardEntry;
  currentWeek: number;
  finalWeek: number;
  userTeamId: string;
}) {
  const { recruit } = entry;
  if (recruit.status !== 'open') return null;
  const decisionWeek = recruitDecisionWeek(recruit.id, recruit.starRating, finalWeek);
  const finalistPhase = isFinalistPhase(currentWeek, decisionWeek) && recruit.scholarshipOffers.length >= 2;
  const userHasOffer = recruit.scholarshipOffers.some((o) => o.teamId === userTeamId);

  if (finalistPhase && userHasOffer) {
    const isFinalist = finalistTeamIds(recruit).includes(userTeamId);
    return (
      <span
        className={`decision-chip ${isFinalist ? 'decision-finalist' : 'decision-outside'}`}
        title={
          isFinalist
            ? `You made the final three — decision expected Week ${decisionWeek}`
            : `Outside the final three — decision expected Week ${decisionWeek}`
        }
      >
        {isFinalist ? 'Finalist' : 'Outside top 3'} · Wk {decisionWeek}
      </span>
    );
  }

  return (
    <span className="decision-chip" title="When this recruit plans to announce a commitment">
      Decides Wk {decisionWeek}{decisionWeek > finalWeek ? ' (signing day)' : ''}
    </span>
  );
}

/**
 * Revealed motivations double as actions: click a chip to pitch that angle.
 * Pitching a recruit committed elsewhere is a flip attempt at double cost.
 */
function PitchChips({
  entry,
  tier,
  userTeamId,
  recruitingActivity,
  hoursAvailable,
  onPitchRecruit,
}: {
  entry: LacrosseBoardEntry;
  tier: 'none' | 'partial' | 'full';
  userTeamId: string;
  recruitingActivity: RecruitingActivity;
  hoursAvailable: number;
  onPitchRecruit: (recruitId: string, motivation: RecruitMotivation) => void;
}) {
  const { recruit } = entry;
  const motivations = revealedMotivations(entry, tier);
  if (motivations.length === 0) return null;

  const isOurs = recruit.committedTeamId === userTeamId || recruit.signedTeamId === userTeamId;
  const isSigned = recruit.status === 'signed';
  const isFlipAttempt = recruit.status === 'committed' && !isOurs;
  const pitchable = !isOurs && !isSigned;

  if (!pitchable) {
    return (
      <span className="motive-static">
        {motivations.map((m) => (
          <span key={m} className="motive-chip">{MOTIVATION_LABELS[m]}</span>
        ))}
      </span>
    );
  }

  const cost = isFlipAttempt ? HOURS_COST.flipPitch : HOURS_COST.pitch;
  const pitched = recruitingActivity.pitchedIds.includes(recruit.id);

  return (
    <span className="motive-static">
      {motivations.map((m) => (
        <button
          key={m}
          className="motive-chip motive-chip-btn"
          disabled={pitched || hoursAvailable < cost}
          title={
            pitched
              ? 'Already pitched this week'
              : hoursAvailable < cost
                ? `Not enough recruiting hours (${cost}h)`
                : `${isFlipAttempt ? 'Flip attempt — pitch' : 'Pitch'} ${MOTIVATION_LABELS[m]} (${cost}h)`
          }
          onClick={() => onPitchRecruit(recruit.id, m)}
        >
          {MOTIVATION_LABELS[m]} · {cost}h
        </button>
      ))}
      {pitched && <span className="pitched-chip" title="Pitched this week">✓</span>}
    </span>
  );
}

function VisitButton({
  entry,
  tier,
  recruitingActivity,
  hoursAvailable,
  hasHomeGameThisWeek,
  onToggleVisitInvite,
}: {
  entry: LacrosseBoardEntry;
  tier: 'none' | 'partial' | 'full';
  recruitingActivity: RecruitingActivity;
  hoursAvailable: number;
  hasHomeGameThisWeek: boolean;
  onToggleVisitInvite: (recruitId: string) => void;
}) {
  const { recruit } = entry;
  if (recruit.status !== 'open' || tier === 'none') return null;
  const scheduled = recruitingActivity.visitIds.includes(recruit.id);

  if (scheduled) {
    return (
      <button
        className="visit-btn visit-btn-scheduled"
        title="Visiting this week's home game — click to withdraw the invite"
        onClick={() => onToggleVisitInvite(recruit.id)}
      >
        Visiting ✓
      </button>
    );
  }

  const disabled = !hasHomeGameThisWeek || hoursAvailable < HOURS_COST.visit;
  return (
    <button
      className="visit-btn"
      disabled={disabled}
      title={
        !hasHomeGameThisWeek
          ? 'No home game this week to host a visit'
          : hoursAvailable < HOURS_COST.visit
            ? `Not enough recruiting hours (${HOURS_COST.visit}h)`
            : `Invite to this week's home game (${HOURS_COST.visit}h) — a big win and a packed house sell the program`
      }
      onClick={() => onToggleVisitInvite(recruit.id)}
    >
      Visit ({HOURS_COST.visit}h)
    </button>
  );
}

export function RecruitingScreen({
  recruitBoard,
  portalEntries,
  scouting,
  recruitingActivity,
  recruitTrends,
  hasHomeGameThisWeek,
  finalWeek,
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
  onPitchRecruit,
  onToggleVisitInvite,
  onOfferPortalPlayer,
  onWithdrawPortalOffer,
  nil,
  portalTeams,
  portalScholarshipRoom,
  seasonYear,
  onRecruitPosFilterChange,
  onRecruitTabChange,
  onToggleShortlist,
  onBoardViewChange,
  onSelectRecruit,
  assistantReport,
  autoAssistant,
  onRunAssistant,
  onAutoAssistantChange,
  onMakeOffers,
  autoOffers,
  onAutoOffersChange,
  classNeeds,
  pipelines,
  landChances,
}: {
  recruitBoard: LacrosseBoardEntry[];
  portalEntries: LacrossePortalEntry[];
  scouting: ScoutingState;
  recruitingActivity: RecruitingActivity;
  recruitTrends: Record<string, number>;
  hasHomeGameThisWeek: boolean;
  finalWeek: number;
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
  onPitchRecruit: (recruitId: string, motivation: RecruitMotivation) => void;
  onToggleVisitInvite: (recruitId: string) => void;
  onOfferPortalPlayer: (entryId: string, scholarshipPercent: number) => void;
  onWithdrawPortalOffer: (entryId: string) => void;
  nil?: PortalNilProps;
  portalTeams: LacrosseTeam[];
  portalScholarshipRoom: number;
  seasonYear: number;
  onRecruitPosFilterChange: (pos: LacrossePosition | 'ALL') => void;
  onRecruitTabChange: (tab: 'board' | 'portal') => void;
  onToggleShortlist: (recruitId: string) => void;
  onBoardViewChange: (view: RecruitBoardView) => void;
  onSelectRecruit: (recruitId: string) => void;
  assistantReport?: AssistantReportData | null;
  autoAssistant?: boolean;
  onRunAssistant?: () => void;
  onAutoAssistantChange?: (on: boolean) => void;
  onMakeOffers?: (offers: Array<{ recruitId: string; scholarshipPercent: number }>) => void;
  autoOffers?: boolean;
  onAutoOffersChange?: (on: boolean) => void;
  classNeeds?: PositionNeed[];
  pipelines?: PipelineRow[];
  landChances?: Map<string, LandChance> | undefined;
}) {
  const [boardSort, setBoardSort] = useState<BoardSort>('rank');
  const [hideCommitted, setHideCommitted] = useState(false);

  const shortlistSet = new Set(shortlistIds);
  const isOurs = (entry: LacrosseBoardEntry) =>
    entry.recruit.committedTeamId === userTeamId || entry.recruit.signedTeamId === userTeamId;
  const boardEntries = recruitBoard.filter((e) => shortlistSet.has(e.recruit.id) || isOurs(e));

  const matchesPosFilter = (entry: LacrosseBoardEntry) =>
    recruitPosFilter === 'ALL' || entry.recruit.position === recruitPosFilter;

  const pipelineMap = new Map((pipelines ?? []).map((p) => [p.regionId, p]));

  return (
    <PipelineContext.Provider value={pipelineMap}>
    <LandChanceContext.Provider value={landChances}>
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
            <span className="scout-pts-label">Recruiting Hours</span>
            <span className="scout-pts-hint">
              (+{scouting.pointsPerWeek}/wk · scout {HOURS_COST.scout}h · pitch {HOURS_COST.pitch}h · visit {HOURS_COST.visit}h)
            </span>
            {onRunAssistant && (
              <div className="assistant-controls">
                <button
                  className="offer-btn assistant-btn"
                  onClick={onRunAssistant}
                  disabled={scouting.pointsAvailable < 1}
                  title={`Spend this week's hours now: pitch the recruits you've offered or pinned, then scout the best fits. ${autoOffers ? 'On Full control it also makes the scholarship offers it suggests.' : 'It suggests scholarship offers for you to approve.'} It never books visits.`}
                >
                  Run Assistant
                </button>
                <label
                  className="assistant-auto"
                  title="Off: nothing happens unless you click Run Assistant. Scout and pitch: each week the staff spends your hours pitching recruits you've offered or pinned and scouting good fits. Full control: the staff also offers scholarships, only to recruits you can realistically land."
                >
                  Staff each week
                  <select
                    aria-label="Recruiting staff each week"
                    value={staffModeOf(autoAssistant ?? false, autoOffers ?? false)}
                    onChange={(e) => {
                      const mode = e.target.value as StaffMode;
                      onAutoAssistantChange?.(mode !== 'off');
                      onAutoOffersChange?.(mode === 'full');
                    }}
                  >
                    <option value="off">Off: I recruit myself</option>
                    <option value="pitch">Scout and pitch</option>
                    {onAutoOffersChange && <option value="full">Full control (makes offers)</option>}
                  </select>
                </label>
              </div>
            )}
          </div>
        )}
      </div>

      {recruitTab === 'board' && assistantReport && <AssistantReport
          report={assistantReport}
          onSelectRecruit={onSelectRecruit}
          onMakeOffers={onMakeOffers ?? ((offers) => offers.forEach((o) => onOfferScholarship(o.recruitId, o.scholarshipPercent)))}
        />}

      {recruitTab === 'board' && pipelines && <PipelinesBar pipelines={pipelines} />}

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
                    <option value="rank" title="Fit, need and talent, weighted by your chance to land him">Best for Us</option>
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

          {classNeeds && classNeeds.some((n) => n.graduating > 0) && (
            <ClassNeedsBar needs={classNeeds} active={recruitPosFilter} onSelect={onRecruitPosFilterChange} />
          )}

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
              recruitingActivity={recruitingActivity}
              recruitTrends={recruitTrends}
              hasHomeGameThisWeek={hasHomeGameThisWeek}
              finalWeek={finalWeek}
              userTeamId={userTeamId}
              teamMap={teamMap}
              currentWeek={currentWeek}
              shortlistSet={shortlistSet}
              budgetRemaining={scholarshipBudget.total - scholarshipBudget.used}
              onOfferScholarship={onOfferScholarship}
              onScoutRecruit={onScoutRecruit}
              onPitchRecruit={onPitchRecruit}
              onToggleVisitInvite={onToggleVisitInvite}
              onToggleShortlist={onToggleShortlist}
              onSelectRecruit={onSelectRecruit}
              onBrowseAll={() => onBoardViewChange('all')}
            />
          ) : (
            <AllRecruitsList
              key={`${recruitPosFilter}-${boardSort}-${hideCommitted}`}
              entries={recruitBoard.filter(matchesPosFilter)}
              sort={boardSort}
              hideCommitted={hideCommitted}
              scouting={scouting}
              recruitingActivity={recruitingActivity}
              recruitTrends={recruitTrends}
              hasHomeGameThisWeek={hasHomeGameThisWeek}
              finalWeek={finalWeek}
              userTeamId={userTeamId}
              teamMap={teamMap}
              currentWeek={currentWeek}
              shortlistSet={shortlistSet}
              budgetRemaining={scholarshipBudget.total - scholarshipBudget.used}
              onOfferScholarship={onOfferScholarship}
              onScoutRecruit={onScoutRecruit}
              onPitchRecruit={onPitchRecruit}
              onToggleVisitInvite={onToggleVisitInvite}
              onToggleShortlist={onToggleShortlist}
              onSelectRecruit={onSelectRecruit}
            />
          )}
        </>
      )}

      {recruitTab === 'portal' && (
        <PortalBoard
          entries={portalEntries}
          teams={portalTeams}
          userTeamId={userTeamId}
          teamMap={teamMap}
          seasonYear={seasonYear}
          scholarshipRoom={portalScholarshipRoom}
          onOffer={onOfferPortalPlayer}
          onWithdraw={onWithdrawPortalOffer}
          {...(nil ? { nil } : {})}
        />
      )}
    </div>
    </LandChanceContext.Provider>
    </PipelineContext.Provider>
  );
}

function ShortlistBoard({
  entries,
  totalOnBoard,
  scouting,
  recruitingActivity,
  recruitTrends,
  hasHomeGameThisWeek,
  finalWeek,
  userTeamId,
  teamMap,
  currentWeek,
  shortlistSet,
  budgetRemaining,
  onOfferScholarship,
  onScoutRecruit,
  onPitchRecruit,
  onToggleVisitInvite,
  onToggleShortlist,
  onSelectRecruit,
  onBrowseAll,
}: {
  entries: LacrosseBoardEntry[];
  totalOnBoard: number;
  scouting: ScoutingState;
  recruitingActivity: RecruitingActivity;
  recruitTrends: Record<string, number>;
  hasHomeGameThisWeek: boolean;
  finalWeek: number;
  userTeamId: string;
  teamMap: Map<string, string>;
  currentWeek: number;
  shortlistSet: Set<string>;
  budgetRemaining: number;
  onOfferScholarship: (recruitId: string, scholarshipPercent: number) => void;
  onScoutRecruit: (recruitId: string, trueOvr: number) => void;
  onPitchRecruit: (recruitId: string, motivation: RecruitMotivation) => void;
  onToggleVisitInvite: (recruitId: string) => void;
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
            recruitingActivity={recruitingActivity}
            recruitTrends={recruitTrends}
            hasHomeGameThisWeek={hasHomeGameThisWeek}
            finalWeek={finalWeek}
            userTeamId={userTeamId}
            teamMap={teamMap}
            currentWeek={currentWeek}
            pinned={shortlistSet.has(entry.recruit.id)}
            budgetRemaining={budgetRemaining}
            onOfferScholarship={onOfferScholarship}
            onScoutRecruit={onScoutRecruit}
            onPitchRecruit={onPitchRecruit}
            onToggleVisitInvite={onToggleVisitInvite}
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
  recruitingActivity,
  recruitTrends,
  hasHomeGameThisWeek,
  finalWeek,
  userTeamId,
  teamMap,
  currentWeek,
  shortlistSet,
  budgetRemaining,
  onOfferScholarship,
  onScoutRecruit,
  onPitchRecruit,
  onToggleVisitInvite,
  onToggleShortlist,
  onSelectRecruit,
}: {
  entries: LacrosseBoardEntry[];
  sort: BoardSort;
  hideCommitted: boolean;
  scouting: ScoutingState;
  recruitingActivity: RecruitingActivity;
  recruitTrends: Record<string, number>;
  hasHomeGameThisWeek: boolean;
  finalWeek: number;
  userTeamId: string;
  teamMap: Map<string, string>;
  currentWeek: number;
  shortlistSet: Set<string>;
  budgetRemaining: number;
  onOfferScholarship: (recruitId: string, scholarshipPercent: number) => void;
  onScoutRecruit: (recruitId: string, trueOvr: number) => void;
  onPitchRecruit: (recruitId: string, motivation: RecruitMotivation) => void;
  onToggleVisitInvite: (recruitId: string) => void;
  onToggleShortlist: (recruitId: string) => void;
  onSelectRecruit: (recruitId: string) => void;
}) {
  const [page, setPage] = useState(0);
  const chances = useContext(LandChanceContext);
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
        // Fit, need and talent, discounted by how likely he is to pick us.
        return attainableBoardScore(entry.score, chances?.get(recruit.id));
    }
  };

  const sorted =
    sort === 'rank' && !chances
      ? visible
      : visible
          .map((entry, index) => ({ entry, index }))
          .sort((a, b) => sortValue(b.entry) - sortValue(a.entry) || a.index - b.index)
          .map(({ entry }) => entry);

  const pageCount = Math.max(1, Math.ceil(sorted.length / RECRUITS_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageStart = currentPage * RECRUITS_PAGE_SIZE;
  const pageEntries = sorted.slice(pageStart, pageStart + RECRUITS_PAGE_SIZE);
  const pager = pageCount > 1 && (
    <div className="pager recruit-pager" role="navigation" aria-label="Recruit pages">
      <button className="ghost-btn" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0}>
        ‹ Prev
      </button>
      <span className="dim">
        {pageStart + 1}–{pageStart + pageEntries.length} of {sorted.length}
      </span>
      <button className="ghost-btn" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pageCount - 1}>
        Next ›
      </button>
    </div>
  );

  return (
    <div className="recruit-list">
      {pager}
      <div className="recruit-row recruit-list-head" aria-hidden="true">
        <span className="pin-btn-spacer" />
        <span className="recruit-row-main">Recruit</span>
        <span className="recruit-row-ovr">OVR</span>
        <span className="recruit-row-status" title="Chance to land: where the race for him stands, counting rival offers and the weeks left">Chance to land</span>
        <span className="recruit-row-actions">Actions</span>
      </div>
      {pageEntries.map((entry) => {
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
        const chance = chances?.get(recruit.id);

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
                <PipelineChip regionId={recruit.regionId} />
                {(tier !== 'none' || starsArePublic(entry)) && (
                  <DecisionChip entry={entry} currentWeek={currentWeek} finalWeek={finalWeek} userTeamId={userTeamId} />
                )}
                <PitchChips
                  entry={entry}
                  tier={tier}
                  userTeamId={userTeamId}
                  recruitingActivity={recruitingActivity}
                  hoursAvailable={scouting.pointsAvailable}
                  onPitchRecruit={onPitchRecruit}
                />
              </span>
            </div>

            <div className="recruit-row-ovr">
              {displayOvr !== null ? (
                <span className={`board-score${tier === 'partial' ? ' fuzzy-ovr' : ''}`}>
                  {displayOvr}
                  {tier === 'partial' && <span className="fuzzy-tilde">~</span>}
                </span>
              ) : (
                <span className="board-score hidden-stat" title="Scout him to see his rating">??</span>
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
              ) : (
                <>
                  {chance && (tier !== 'none' || starsArePublic(entry)) && <LandChip chance={chance} />}
                  {hasOffer ? (
                    <span className="row-interest">
                      Interest {userInterest}
                      <TrendArrow delta={recruitTrends[recruit.id]} />
                    </span>
                  ) : (
                    !chance || (tier === 'none' && !starsArePublic(entry)) ? (
                      <span className="row-interest dim-interest" title="Scout him to size up the race">Not scouted</span>
                    ) : null
                  )}
                </>
              )}
            </div>

            <div className="recruit-row-actions">
              {!isCommittedToUs && !isCommittedElsewhere && (
                <>
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
                  <VisitButton
                    entry={entry}
                    tier={tier}
                    recruitingActivity={recruitingActivity}
                    hoursAvailable={scouting.pointsAvailable}
                    hasHomeGameThisWeek={hasHomeGameThisWeek}
                    onToggleVisitInvite={onToggleVisitInvite}
                  />
                  {tier !== 'full' && (
                    <button
                      className="scout-btn scout-btn-row"
                      onClick={() => onScoutRecruit(recruit.id, recruit.ratings.overall)}
                      disabled={scouting.pointsAvailable <= 0}
                    >
                      {tier === 'partial' ? 'Full Scout (1h)' : 'Scout (1h)'}
                    </button>
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
      {pager}
    </div>
  );
}

const COLLAPSED_ITEMS = 5;

/** Long assistant lists show the first few, with the rest a click away. */
function CollapsibleList({ label, children }: { label: string; children: ReactNode[] }) {
  const [expanded, setExpanded] = useState(false);
  const items = children.filter(Boolean);
  const hidden = items.length - COLLAPSED_ITEMS;
  return (
    <>
      <ul>{expanded || hidden <= 0 ? items : items.slice(0, COLLAPSED_ITEMS)}</ul>
      {hidden > 0 && (
        <button type="button" className="link-btn assistant-more" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show fewer' : `+${hidden} more ${label}`}
        </button>
      )}
    </>
  );
}

function AssistantReport({
  report,
  onSelectRecruit,
  onMakeOffers,
}: {
  report: AssistantReportData;
  onSelectRecruit: (recruitId: string) => void;
  onMakeOffers: (offers: Array<{ recruitId: string; scholarshipPercent: number }>) => void;
}) {
  const { actions, needsOffer, suggestedOffers } = report;
  const offersMade = actions.filter((a) => a.type === 'offer');
  const suggestedCost = suggestedOffers.reduce((sum, o) => sum + o.scholarshipPercent / 100, 0);
  const pitches = actions.filter((a) => a.type === 'pitch');
  const scouts = actions.filter((a) => a.type === 'scout');
  return (
    <article className="card assistant-report" aria-label="Recruiting assistant report">
      <h3>Recruiting Coordinator Report</h3>
      {actions.length === 0 ? (
        <p className="dim">Nothing to do: no hours left, or no pinned or offered recruits ready to pitch or scout.</p>
      ) : (
        <div className="assistant-columns">
          <div>
            <h4>Pitches ({pitches.length})</h4>
            {pitches.length === 0 ? (
              <p className="dim">No scouted targets to pitch yet. Pin or offer recruits and the staff pitches them once scouted.</p>
            ) : (
              <CollapsibleList label="pitches">
                {pitches.map((a) => a.type === 'pitch' && (
                  <li key={a.recruitId}>
                    {a.name}: sold {MOTIVATION_LABELS[a.motivation]}{' '}
                    <span className={a.interestChange > 0 ? 'positive' : 'negative'}>
                      ({a.interestChange > 0 ? '+' : ''}{a.interestChange})
                    </span>
                  </li>
                ))}
              </CollapsibleList>
            )}
          </div>
          <div>
            <h4>Scouting ({scouts.length})</h4>
            {scouts.length === 0 ? (
              <p className="dim">No hours left for scouting.</p>
            ) : (
              <CollapsibleList label="scouting reports">
                {scouts.map((a, i) => a.type === 'scout' && (
                  <li key={`${a.recruitId}-${i}`}>
                    {a.name}: {a.tier === 'full' ? 'full report' : 'first look'}
                  </li>
                ))}
              </CollapsibleList>
            )}
          </div>
        </div>
      )}
      {offersMade.length > 0 && (
        <p className="assistant-offers-made">
          <strong>Offers made:</strong>{' '}
          {offersMade.map((a) => (a.type === 'offer' ? `${a.name} (${a.scholarshipPercent}%)` : '')).join(', ')}
        </p>
      )}
      {suggestedOffers.length > 0 && (
        <div className="assistant-offers" aria-label="Suggested scholarship offers">
          <div className="assistant-offers-head">
            <h4>Suggested Offers ({suggestedOffers.length})</h4>
            <span className="dim">Replaces this year&apos;s graduates · {suggestedCost.toFixed(2)} scholarships</span>
            <button
              className="offer-btn assistant-btn"
              onClick={() => onMakeOffers(suggestedOffers.map(({ recruitId, scholarshipPercent }) => ({ recruitId, scholarshipPercent })))}
            >
              Make All {suggestedOffers.length} Offers
            </button>
          </div>
          <ul>
            {suggestedOffers.map((o) => (
              <li key={o.recruitId}>
                <button className="link-btn" onClick={() => onSelectRecruit(o.recruitId)}>
                  {o.name}
                </button>
                <span className="dim">
                  {o.position} · {'★'.repeat(o.starRating)}
                </span>
                <button
                  className="offer-btn assistant-btn offer-btn-sm"
                  onClick={() => onMakeOffers([{ recruitId: o.recruitId, scholarshipPercent: o.scholarshipPercent }])}
                >
                  Offer {o.scholarshipPercent}%
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {needsOffer.length > 0 && (
        <p className="assistant-needs-offer">
          <strong>Needs your call:</strong> pitches alone won't land{' '}
          {needsOffer.map((n, k) => (
            <span key={n.recruitId}>
              {k > 0 && ', '}
              <button className="link-btn" onClick={() => onSelectRecruit(n.recruitId)}>
                {n.name}
              </button>
            </span>
          ))}
          . They're on your board without a scholarship offer.
        </p>
      )}
    </article>
  );
}

function RecruitCard({
  entry,
  scouting,
  recruitingActivity,
  recruitTrends,
  hasHomeGameThisWeek,
  finalWeek,
  userTeamId,
  teamMap,
  currentWeek,
  pinned,
  budgetRemaining,
  onOfferScholarship,
  onScoutRecruit,
  onPitchRecruit,
  onToggleVisitInvite,
  onToggleShortlist,
  onSelectRecruit,
}: {
  entry: LacrosseBoardEntry;
  scouting: ScoutingState;
  recruitingActivity: RecruitingActivity;
  recruitTrends: Record<string, number>;
  hasHomeGameThisWeek: boolean;
  finalWeek: number;
  userTeamId: string;
  teamMap: Map<string, string>;
  currentWeek: number;
  pinned: boolean;
  budgetRemaining: number;
  onOfferScholarship: (recruitId: string, scholarshipPercent: number) => void;
  onScoutRecruit: (recruitId: string, trueOvr: number) => void;
  onPitchRecruit: (recruitId: string, motivation: RecruitMotivation) => void;
  onToggleVisitInvite: (recruitId: string) => void;
  onToggleShortlist: (recruitId: string) => void;
  onSelectRecruit: (recruitId: string) => void;
}) {
  const { recruit } = entry;
  const tier = getScoutTier(recruit.id, scouting);
  const displayOvr = getDisplayOvr(recruit.id, recruit.ratings.overall, scouting);
  const userInterest = recruit.interestByTeamId[userTeamId] ?? 0;
  const chance = useContext(LandChanceContext)?.get(recruit.id);
  const userOffer = recruit.scholarshipOffers.find((o) => o.teamId === userTeamId);
  const hasOffer = userOffer !== undefined;
  const isCommittedToUs =
    recruit.committedTeamId === userTeamId || recruit.signedTeamId === userTeamId;
  const isCommittedElsewhere = recruit.status !== 'open' && !isCommittedToUs;
  const fullName = `${recruit.name.first} ${recruit.name.last}`;
  const showStars = tier !== 'none' || starsArePublic(entry);

  const competitors = recruit.scholarshipOffers
    .filter((o) => o.teamId !== userTeamId)
    .map((o) => ({
      teamId: o.teamId,
      name: formatTeamShort(teamMap.get(o.teamId) ?? o.teamId),
      interest: recruit.interestByTeamId[o.teamId] ?? 0,
    }))
    .sort((a, b) => b.interest - a.interest)
    .slice(0, 3);

  // Where the user stands in the race, CFB-style: 1st of 4, 2nd of 3, ...
  const standing = hasOffer
    ? recruit.scholarshipOffers
        .map((o) => recruit.interestByTeamId[o.teamId] ?? 0)
        .filter((interest) => interest > userInterest).length + 1
    : null;

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
            {showStars && (
              <>
                {' '}
                <DecisionChip entry={entry} currentWeek={currentWeek} finalWeek={finalWeek} userTeamId={userTeamId} />
              </>
            )}
            <PipelineChip regionId={recruit.regionId} />
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

      {revealedMotivations(entry, tier).length > 0 && (
        <div className="motive-row">
          <PitchChips
            entry={entry}
            tier={tier}
            userTeamId={userTeamId}
            recruitingActivity={recruitingActivity}
            hoursAvailable={scouting.pointsAvailable}
            onPitchRecruit={onPitchRecruit}
          />
        </div>
      )}

      {tier !== 'none' && hasOffer && (
        <>
          <div className="interest-bar-wrap">
            <div className="interest-bar" style={{ width: `${userInterest}%` }} />
          </div>
          <div className="recruit-interest-row">
            <span className="interest-label">
              Interest {userInterest}/100
              <TrendArrow delta={recruitTrends[recruit.id]} />
            </span>
            {standing !== null && !isCommittedToUs && !isCommittedElsewhere && (
              <span className={`commit-pct${standing === 1 ? ' hot' : standing === 2 ? ' warm' : ''}`}>
                {ordinal(standing)} of {recruit.scholarshipOffers.length}
              </span>
            )}
            {chance && <LandChip chance={chance} />}
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
            Scout (1h)
          </button>
        ) : (
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
            <VisitButton
              entry={entry}
              tier={tier}
              recruitingActivity={recruitingActivity}
              hoursAvailable={scouting.pointsAvailable}
              hasHomeGameThisWeek={hasHomeGameThisWeek}
              onToggleVisitInvite={onToggleVisitInvite}
            />
            {tier === 'partial' && (
              <button
                className="scout-btn scout-btn-sm"
                onClick={() => onScoutRecruit(recruit.id, recruit.ratings.overall)}
                disabled={scouting.pointsAvailable <= 0}
              >
                Full Scout (1h)
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function ordinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}
function ClassNeedsBar({
  needs,
  active,
  onSelect,
}: {
  needs: PositionNeed[];
  active: LacrossePosition | 'ALL';
  onSelect: (pos: LacrossePosition | 'ALL') => void;
}) {
  const totals = needs.reduce(
    (t, n) => ({ graduating: t.graduating + n.graduating, committed: t.committed + n.committed, open: t.open + n.open }),
    { graduating: 0, committed: 0, open: 0 },
  );
  return (
    <section className="class-needs" aria-label="Class needs">
      <div className="class-needs-summary">
        <strong>Class Needs</strong>
        <span className="dim">
          {totals.graduating} graduating · {totals.committed} committed · {totals.open} spots open
        </span>
      </div>
      <div className="class-needs-row">
        {needs
          .filter((n) => n.graduating > 0 || n.committed > 0)
          .map((n) => {
            const status = n.open === 0 ? 'filled' : n.offersOut >= n.open ? 'covered' : 'short';
            return (
              <button
                key={n.position}
                type="button"
                className={`class-need class-need-${status}${active === n.position ? ' active' : ''}`}
                onClick={() => onSelect(active === n.position ? 'ALL' : (n.position as LacrossePosition))}
                title={`${n.graduating} graduating, ${n.returning} returning, ${n.committed} committed, ${n.offersOut} live offers`}
              >
                <span className="class-need-pos">{n.position}</span>
                <span className="class-need-count">
                  {n.committed}/{n.graduating}
                </span>
                <span className="class-need-detail">
                  {n.open === 0 ? 'Filled' : `${n.open} open · ${n.offersOut} out`}
                </span>
              </button>
            );
          })}
      </div>
    </section>
  );
}
