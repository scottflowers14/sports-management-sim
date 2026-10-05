import { useState } from 'react';
import {
  applyInvestmentPlan,
  draftSlotLabel,
  fundProject,
  INVESTMENT_PROJECT_INFO,
  INVESTMENT_PROJECTS,
  planCost,
} from '@sports-management-sim/sport-lacrosse';
import type {
  CarouselChange,
  CoachDepartureReason,
  InvestmentPlan,
  InvestmentProject,
  LacrossePortalEntry,
  LacrosseTeam,
  ProDraftPick,
} from '@sports-management-sim/sport-lacrosse';
import { PORTAL_REASON_LABELS } from '@sports-management-sim/engine-core';
import { OfferControl } from '../components/OfferControl';
import { portalStanding } from './PortalBoard';
import type { OffseasonSummary } from '../dynasty-helpers';
import { GATE_FANS_PER_POINT, conferenceStrength, type GateReceipts, type RealignmentMove } from '@sports-management-sim/sport-lacrosse';
import type { DynastySeasonRecord } from '../history';
import {
  ALL_AMERICA_TIERS,
  ALL_AMERICA_TIER_LABELS,
  programAllAmericans,
  type AllAmericaTeams,
  CONFERENCE_TIER_LABELS,
  type AllAmericaTier,
  type ConferenceHonors,
  type ConferenceTier,
  type SeasonAwards,
} from '../awards';
import type { JobOffer } from '../coach-profile';
import type { PlayerDevelopmentEntry } from '../development-report';
import { formatTeamName, formatTeamShort } from '../ui/format';

export function OffseasonScreen({
  offseasonSummary,
  userTeam,
  portalEntries,
  teamMap,
  dynastyHistory,
  seasonYear,
  userTeamId,
  jobOffers,
  coachName,
  onAcceptJobOffer,
  onStartNewSeason,
  onOfferPortalPlayer,
  portalTeams,
  portalScholarshipRoom,
  onOpenPortal,
  investments,
  realignment,
}: {
  offseasonSummary: OffseasonSummary;
  userTeam: LacrosseTeam;
  portalEntries: LacrossePortalEntry[];
  teamMap: Map<string, string>;
  dynastyHistory: DynastySeasonRecord[];
  seasonYear: number;
  userTeamId: string;
  jobOffers: JobOffer[] | null;
  coachName: string | null;
  onAcceptJobOffer: (teamId: string) => void;
  onStartNewSeason: () => void;
  onOfferPortalPlayer: (entryId: string, scholarshipPercent: number) => void;
  portalTeams: LacrosseTeam[];
  portalScholarshipRoom: number;
  onOpenPortal: () => void;
  investments?: {
    budget: number;
    plan: InvestmentPlan;
    onFund: (project: InvestmentProject) => void;
    onUnfund: (project: InvestmentProject) => void;
  };
  realignment?: {
    conferences: Array<{ id: string; name: string; shortName: string; teamIds: string[] }>;
    teams: LacrosseTeam[];
    onAnswer: (accept: boolean) => void;
  };
}) {
  const availablePortal = portalEntries.filter((e) => e.status === 'available');
  const departures = offseasonSummary.portalDepartures ?? [];
  const ourOffers = availablePortal.filter((e) => e.offersByTeamId[userTeamId] !== undefined).length;
  // Best fits first: the highest-rated transfers we'd actually start.
  const targets = [...availablePortal]
    .filter((e) => e.sourceTeamId !== userTeamId)
    .sort((a, b) => b.ratings.overall - a.ratings.overall)
    .slice(0, 8);
  const teamShort = (id: string) => formatTeamShort(teamMap.get(id) ?? id);

  return (
    <div className="offseason-layout">
      <div className="offseason-left">
        <article className="card season-recap-card">
          <p className="eyebrow">{offseasonSummary.seasonYear} Season Recap</p>
          {(() => {
            const poll = offseasonSummary.finalPoll;
            const userRow = poll?.find((row) => row.teamId === userTeamId);
            const { wins, losses } = userRow ?? offseasonSummary.userRecord;
            const regular = offseasonSummary.userRecord;
            const hasPostseason = userRow !== undefined && (userRow.wins !== regular.wins || userRow.losses !== regular.losses);
            return (
              <h2>
                {userRow ? `Final poll #${userRow.rank}` : `Finished #${offseasonSummary.userStanding}`} · {wins}–{losses}
                {hasPostseason && (
                  <span className="recap-regular dim"> ({regular.wins}–{regular.losses} regular season)</span>
                )}
              </h2>
            );
          })()}
          <table className="standings-table recap-table">
            <thead>
              <tr>
                <th>{offseasonSummary.finalPoll ? 'Poll' : ''}</th>
                <th>Team</th>
                <th>W</th>
                <th>L</th>
              </tr>
            </thead>
            <tbody>
              {(offseasonSummary.finalPoll
                ?? offseasonSummary.finalStandings.map((entry, i) => ({ teamId: entry.teamId, rank: i + 1, ...entry.record }))
              ).map((row) => (
                <tr
                  key={row.teamId}
                  className={row.teamId === userTeamId ? 'user-row' : ''}
                >
                  <td className="rank">#{row.rank}</td>
                  <td>{formatTeamName(teamMap.get(row.teamId) ?? row.teamId)}</td>
                  <td>{row.wins}</td>
                  <td>{row.losses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        {offseasonSummary.awards && (
          <AwardsSection
            awards={offseasonSummary.awards}
            userTeamId={userTeamId}
            conference={(() => {
              // The league the season was played in, before any realignment move.
              const id = offseasonSummary.finalStandings.find((e) => e.teamId === userTeamId)?.conferenceId ?? userTeam.conferenceId;
              const league = realignment?.conferences.find((c) => c.id === id);
              return { id, name: league?.shortName ?? league?.name ?? id.toUpperCase() };
            })()}
            coachOfYear={
              offseasonSummary.coachOfYear
                ? {
                    name: offseasonSummary.coachOfYear.teamId === userTeamId ? (coachName ?? 'You') : (offseasonSummary.coachOfYear.coachName ?? ''),
                    teamName: teamMap.get(offseasonSummary.coachOfYear.teamId) ?? offseasonSummary.coachOfYear.teamId,
                    detail: `${offseasonSummary.coachOfYear.wins}-${offseasonSummary.coachOfYear.losses} · +${offseasonSummary.coachOfYear.winsAboveExpected.toFixed(1)} wins vs expected`,
                  }
                : null
            }
          />
        )}

        {offseasonSummary.developmentReport && offseasonSummary.developmentReport.entries.length > 0 && (
          <DevelopmentReportCard entries={offseasonSummary.developmentReport.entries} />
        )}
      </div>

      <div className="offseason-right">
        {dynastyHistory.length > 0 && (
          <article className="card prestige-card">
            <h2>Program Prestige</h2>
            <PrestigeSection reputation={userTeam.reputation} />
          </article>
        )}

        {!(jobOffers && jobOffers.length > 0) && investments && (
          <InvestmentsCard team={userTeam} gate={offseasonSummary.gate} {...investments} />
        )}

        <article className="card">
          <h2>Graduating Seniors</h2>
          {offseasonSummary.graduates.length > 0 ? (
            <ul className="player-list">
              {offseasonSummary.graduates.map((p, i) => (
                <li key={i}>
                  <strong>{p.name}</strong>
                  <span>{p.position} · {p.overall} OVR</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dim">No graduating seniors</p>
          )}
        </article>

        <article className="card">
          <h2>Signing Class · {seasonYear - 1}</h2>
          {offseasonSummary.signingClass.length > 0 ? (
            <ul className="player-list">
              {offseasonSummary.signingClass.map((p, i) => (
                <li key={i}>
                  <strong>{p.name}</strong>
                  <span>{p.position} · {'★'.repeat(p.starRating)} · {p.overall} OVR</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dim">No signed recruits</p>
          )}
          {(offseasonSummary.signingDayFlips?.length ?? 0) > 0 && (
            <div className="signing-flips">
              <p className="section-label">Signing Day Flips</p>
              <ul className="player-list">
                {offseasonSummary.signingDayFlips!.map((flip, i) => (
                  <li key={i}>
                    <strong>{flip.name}</strong>
                    <span>
                      {'★'.repeat(flip.starRating)} {flip.position} · flipped from {formatTeamName(flip.fromTeamName)} to{' '}
                      {formatTeamName(flip.toTeamName)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>

        {realignment && (offseasonSummary.realignmentInvite || offseasonSummary.realignment) && (
          <RealignmentCard
            move={(offseasonSummary.realignmentInvite ?? offseasonSummary.realignment)!}
            invite={Boolean(offseasonSummary.realignmentInvite)}
            userTeamId={userTeam.id}
            teamShort={teamShort}
            {...realignment}
          />
        )}

        {(offseasonSummary.proDraft?.length ?? 0) > 0 && (
          <ProDraftCard picks={offseasonSummary.proDraft!} userTeamId={userTeam.id} teamShort={teamShort} />
        )}

        {(offseasonSummary.coachingCarousel?.length ?? 0) > 0 && (
          <CoachingCarouselCard changes={offseasonSummary.coachingCarousel!} teamShort={teamShort} />
        )}

        {(availablePortal.length > 0 || departures.length > 0) && (
          <article className="card portal-offseason-card" aria-label="Transfer portal summary">
            <h2>Transfer Portal · {availablePortal.length} in the portal</h2>
            <p className="portal-hint">
              {ourOffers > 0 ? `${ourOffers} offer${ourOffers === 1 ? '' : 's'} out · ` : ''}
              {portalScholarshipRoom.toFixed(2)} scholarships free · everyone picks a school when the season starts.
            </p>
            {departures.length > 0 && (
              <div className="portal-departures">
                <p className="section-label">Left our program · {departures.length}</p>
                <ul className="player-list">
                  {departures.map((d) => {
                    const entry = portalEntries.find((e) => e.id === d.entryId);
                    const reRecruited = entry?.offersByTeamId[userTeamId] !== undefined;
                    return (
                      <li key={d.entryId}>
                        <strong>{d.name}</strong>
                        <span>
                          {d.classYear} {d.position} · {d.overall} OVR · {PORTAL_REASON_LABELS[d.reason]}
                          {reRecruited ? ' · re-recruiting' : ''}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {targets.length > 0 && (
              <div className="portal-mini-list">
                <p className="section-label">Top available</p>
                {targets.map((entry) => {
                  const ourOffer = entry.offersByTeamId[userTeamId];
                  const standing = portalStanding(entry, portalTeams, userTeamId);
                  const rivals = Object.keys(entry.offersByTeamId).filter((id) => id !== userTeamId).length;
                  return (
                    <div key={entry.id} className="portal-mini-row">
                      <span className="portal-mini-name">
                        {entry.name.first} {entry.name.last}
                      </span>
                      <span className="portal-mini-meta">
                        {entry.classYear} {entry.position} · {entry.ratings.overall} OVR · from {teamShort(entry.sourceTeamId)}
                        {rivals > 0 ? ` · ${rivals} rival offer${rivals === 1 ? '' : 's'}` : ''}
                      </span>
                      {ourOffer !== undefined ? (
                        <span className={`badge ${standing.ourRank === 1 ? 'badge-committed' : 'badge-offered'}`}>
                          {standing.ourRank === 1 ? 'Leading' : 'Behind'} · {ourOffer}%
                        </span>
                      ) : (
                        <OfferControl
                          recruitId={entry.id}
                          recruitName={`${entry.name.first} ${entry.name.last}`}
                          budgetRemaining={portalScholarshipRoom}
                          onOffer={onOfferPortalPlayer}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <button className="hub-nav-link" onClick={onOpenPortal}>
              Open the full portal →
            </button>
          </article>
        )}

        {jobOffers && jobOffers.length > 0 ? (
          <article className="card fired-card">
            <h2>You&apos;ve Been Fired</h2>
            <p className="fired-note">
              The athletic director has relieved {coachName ?? 'you'} of head coaching duties at{' '}
              {formatTeamName(teamMap.get(userTeamId) ?? userTeamId)}. Other programs are calling —
              pick where the next chapter starts.
            </p>
            <div className="job-offer-list">
              {jobOffers.map((offer) => (
                <div key={offer.teamId} className="job-offer-row">
                  <div className="job-offer-info">
                    <strong>{formatTeamName(offer.teamName)}</strong>
                    <span className="job-offer-meta">
                      Prestige {offer.prestige} · {offer.contractYears}-year deal
                    </span>
                  </div>
                  <button className="offer-btn" onClick={() => onAcceptJobOffer(offer.teamId)}>
                    Accept Job
                  </button>
                </div>
              ))}
            </div>
          </article>
        ) : (
          <button className="sim-btn new-season-btn" onClick={onStartNewSeason}>
            Start {seasonYear} Season →
          </button>
        )}
      </div>
    </div>
  );
}

function AwardsSection({
  awards,
  userTeamId,
  conference,
  coachOfYear,
}: {
  awards: SeasonAwards;
  userTeamId: string;
  conference: { id: string; name: string };
  coachOfYear: { name: string; teamName: string; detail: string } | null;
}) {
  return (
    <article className="card">
      <h2>Season Awards</h2>
      <div className="awards-grid">
        {coachOfYear && (
          <div className="award-item" aria-label="Coach of the Year">
            <div className="award-label">Coach of the Year</div>
            <div className="award-player">{coachOfYear.name}</div>
            <div className="award-detail">
              {formatTeamName(coachOfYear.teamName)} · {coachOfYear.detail}
            </div>
          </div>
        )}
        {[
          { label: 'MVP', winner: awards.mvp },
          { label: 'Offensive Player', winner: awards.offensivePlayer },
          { label: 'Defensive Player', winner: awards.defensivePlayer },
          ...(awards.freshmanOfYear ? [{ label: 'Freshman of Year', winner: awards.freshmanOfYear }] : []),
        ].map(({ label, winner }) => (
          <div key={label} className="award-item">
            <div className="award-label">{label}</div>
            <div className="award-player">{winner.playerName}</div>
            <div className="award-detail">
              {winner.position} · {formatTeamName(winner.teamName)} · {winner.statLine ?? `${winner.overall} OVR`}
            </div>
          </div>
        ))}
      </div>
      {awards.allAmerica && <AllAmericaTable teams={awards.allAmerica} userTeamId={userTeamId} />}
      {awards.conferenceHonors?.find((h) => h.conferenceId === conference.id) && (
        <AllConferenceTable
          honors={awards.conferenceHonors.find((h) => h.conferenceId === conference.id)!}
          conferenceName={conference.name}
          userTeamId={userTeamId}
        />
      )}
      {!awards.allAmerica && awards.allConference.length > 0 && (
        <>
          <p className="section-label">All-Conference</p>
          <table className="standings-table">
            <thead>
              <tr>
                <th>Player</th><th>Pos</th><th>Team</th><th>Season</th>
              </tr>
            </thead>
            <tbody>
              {awards.allConference.map((winner, i) => (
                <tr key={i}>
                  <td>{winner.playerName}</td>
                  <td>{winner.position}</td>
                  <td>{formatTeamName(winner.teamName)}</td>
                  <td>{winner.statLine ?? `${winner.overall} OVR`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </article>
  );
}

function AllAmericaTable({ teams, userTeamId }: { teams: AllAmericaTeams; userTeamId: string }) {
  const ours = programAllAmericans(teams, userTeamId);
  const [tier, setTier] = useState<AllAmericaTier>(ours[0]?.tier ?? 'first');
  return (
    <section className="all-america" aria-label="All-America teams">
      <div className="news-header">
        <p className="section-label">
          All-America · {ours.length === 0 ? 'none of yours' : `${ours.length} of yours`}
        </p>
        <div className="news-filters" role="group" aria-label="All-America team">
          {ALL_AMERICA_TIERS.map((t) => {
            const count = teams[t].filter((w) => w.teamId === userTeamId).length;
            return (
              <button
                key={t}
                type="button"
                className={`pos-filter-btn${tier === t ? ' active' : ''}`}
                aria-pressed={tier === t}
                onClick={() => setTier(t)}
              >
                {ALL_AMERICA_TIER_LABELS[t].replace(' All-America', '')}
                {count > 0 ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>
      </div>
      <table className="standings-table">
        <thead>
          <tr>
            <th>Player</th><th>Pos</th><th>Team</th><th>Season</th>
          </tr>
        </thead>
        <tbody>
          {teams[tier].map((winner) => (
            <tr key={winner.playerId ?? winner.playerName} className={winner.teamId === userTeamId ? 'user-row' : ''}>
              <td>{winner.playerName}</td>
              <td>{winner.position}</td>
              <td>{formatTeamName(winner.teamName)}</td>
              <td>{winner.statLine ?? `${winner.overall} OVR`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function AllConferenceTable({
  honors,
  conferenceName,
  userTeamId,
}: {
  honors: ConferenceHonors;
  conferenceName: string;
  userTeamId: string;
}) {
  const [tier, setTier] = useState<ConferenceTier>('first');
  const ours = [...honors.first, ...honors.second].filter((w) => w.teamId === userTeamId).length;
  const poy = honors.playerOfYear;
  return (
    <section className="all-conference" aria-label="All-Conference teams">
      <div className="news-header">
        <p className="section-label">
          All-{conferenceName} · {ours === 0 ? 'none of yours' : `${ours} of yours`}
        </p>
        <div className="news-filters" role="group" aria-label="All-Conference team">
          {(['first', 'second'] as const).map((t) => {
            const count = honors[t].filter((w) => w.teamId === userTeamId).length;
            return (
              <button
                key={t}
                type="button"
                className={`pos-filter-btn${tier === t ? ' active' : ''}`}
                aria-pressed={tier === t}
                onClick={() => setTier(t)}
              >
                {CONFERENCE_TIER_LABELS[t].replace(' All-Conference', '')}
                {count > 0 ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>
      </div>
      {poy && (
        <p className={`conference-poy${poy.teamId === userTeamId ? ' ours' : ''}`}>
          Player of the Year: <strong>{poy.playerName}</strong>, {poy.position}, {formatTeamName(poy.teamName)}
          {poy.statLine ? ` · ${poy.statLine}` : ''}
        </p>
      )}
      <table className="standings-table">
        <thead>
          <tr>
            <th>Player</th><th>Pos</th><th>Team</th><th>Season</th>
          </tr>
        </thead>
        <tbody>
          {honors[tier].map((winner) => (
            <tr key={winner.playerId ?? winner.playerName} className={winner.teamId === userTeamId ? 'user-row' : ''}>
              <td>{winner.playerName}</td>
              <td>{winner.position}</td>
              <td>{formatTeamName(winner.teamName)}</td>
              <td>{winner.statLine ?? `${winner.overall} OVR`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function DevelopmentReportCard({ entries }: { entries: PlayerDevelopmentEntry[] }) {
  const breakouts = entries.filter((e) => e.event === 'breakout');
  const risers = entries.filter((e) => e.event === 'steady_rise');
  const plateaus = entries.filter((e) => e.event === 'plateau');
  const regressions = entries.filter((e) => e.event === 'regression');

  return (
    <article className="card dev-report-card">
      <h2>Player Development</h2>
      {breakouts.length > 0 && (
        <div className="dev-section">
          <p className="section-label dev-breakout-label">Breakouts</p>
          {breakouts.map((e) => (
            <DevRow key={e.playerId} entry={e} />
          ))}
        </div>
      )}
      {risers.length > 0 && (
        <div className="dev-section">
          <p className="section-label dev-rise-label">Steady Risers</p>
          {risers.map((e) => (
            <DevRow key={e.playerId} entry={e} />
          ))}
        </div>
      )}
      {plateaus.length > 0 && (
        <div className="dev-section dev-section-dim">
          <p className="section-label">Plateaued · {plateaus.length} players</p>
        </div>
      )}
      {regressions.length > 0 && (
        <div className="dev-section">
          <p className="section-label dev-regress-label">Regression</p>
          {regressions.map((e) => (
            <DevRow key={e.playerId} entry={e} />
          ))}
        </div>
      )}
    </article>
  );
}

function DevRow({ entry }: { entry: PlayerDevelopmentEntry }) {
  const isBreakout = entry.event === 'breakout';
  const isRegress = entry.event === 'regression';
  const deltaSign = entry.delta > 0 ? '+' : '';
  const deltaClass = isBreakout
    ? 'dev-delta breakout'
    : isRegress
      ? 'dev-delta regress'
      : 'dev-delta rise';

  return (
    <div className="dev-row">
      <span className="dev-player-name">{entry.name}</span>
      <span className="dev-pos-class">{entry.position} · {entry.classYear}</span>
      <span className="dev-ovr-range">
        {entry.oldOverall} → <strong>{entry.newOverall}</strong>
      </span>
      <span className={deltaClass}>{deltaSign}{entry.delta}</span>
      {entry.traitNote && <span className="dev-trait-note">{entry.traitNote}</span>}
    </div>
  );
}

function PrestigeSection({ reputation }: {
  reputation: {
    nationalPrestige: number;
    coachingPrestige: number;
    facilities: number;
    fanSupport: number;
    recentSuccess: number;
  };
}) {
  const bars: [string, number][] = [
    ['National Prestige', reputation.nationalPrestige],
    ['Coaching', reputation.coachingPrestige],
    ['Facilities', reputation.facilities],
    ['Fan Support', reputation.fanSupport],
    ['Recent Success', reputation.recentSuccess],
  ];
  return (
    <div className="prestige-bars">
      {bars.map(([label, val]) => (
        <div key={label} className="rating-row">
          <span>{label}</span>
          <div className="rating-bar-wrap">
            <div className="rating-bar-fill" style={{ width: `${val}%` }} />
          </div>
          <span className="rating-val">{val}</span>
        </div>
      ))}
    </div>
  );
}

const DEPARTURE_VERBS: Record<CoachDepartureReason, string> = {
  fired: 'Fired',
  retired: 'Retired:',
  poached: 'Lost',
};

function CoachingCarouselCard({ changes, teamShort }: { changes: CarouselChange[]; teamShort: (id: string) => string }) {
  return (
    <article className="card" aria-label="Coaching carousel">
      <h2>Coaching Carousel · {changes.length} change{changes.length === 1 ? '' : 's'}</h2>
      <ul className="player-list">
        {changes.map(({ teamId, outgoing, incoming }) => (
          <li key={teamId}>
            <strong>{teamShort(teamId)}</strong>
            <span>
              {DEPARTURE_VERBS[outgoing.reason]} {outgoing.name} ({outgoing.wins}-{outgoing.losses} in {outgoing.seasons}{' '}
              season{outgoing.seasons === 1 ? '' : 's'}){outgoing.reason === 'poached' ? ' to a bigger job' : ''}
            </span>
            <span>
              Hired {incoming.name} ({incoming.rating}){incoming.fromTeamId ? ` from ${teamShort(incoming.fromTeamId)}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function ProDraftCard({ picks, userTeamId, teamShort }: { picks: ProDraftPick[]; userTeamId: string; teamShort: (id: string) => string }) {
  const ours = picks.filter((p) => p.collegeTeamId === userTeamId);
  const [view, setView] = useState<'ours' | 'all'>(ours.length > 0 ? 'ours' : 'all');
  const shown = view === 'ours' ? ours : picks;
  return (
    <article className="card pro-draft-card" aria-label="Pro draft">
      <div className="news-header">
        <h2>Pro Draft · {ours.length} of yours</h2>
        <div className="news-filters" role="group" aria-label="Draft view">
          <button type="button" className={`pos-filter-btn${view === 'ours' ? ' active' : ''}`} aria-pressed={view === 'ours'} onClick={() => setView('ours')}>
            Your players
          </button>
          <button type="button" className={`pos-filter-btn${view === 'all' ? ' active' : ''}`} aria-pressed={view === 'all'} onClick={() => setView('all')}>
            Full draft
          </button>
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="dim">None of your players were drafted. A first-round pick lifts national prestige, and a big final season moves seniors up draft boards.</p>
      ) : (
        <ol className="player-list pro-draft-list">
          {shown.map((p) => (
            <li key={p.playerId} className={p.collegeTeamId === userTeamId ? 'pro-draft-ours' : undefined}>
              <span className="pro-draft-slot">
                {p.round}.{String(p.pick).padStart(2, '0')}
              </span>
              <strong>
                {p.position} {p.name}
              </strong>
              <span>
                {p.overall} OVR · {view === 'ours' ? '' : `${teamShort(p.collegeTeamId)} `}to the {p.proTeam}
              </span>
              {view === 'ours' && <span className="dim">{draftSlotLabel(p)}</span>}
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

const PROJECT_RATING: Record<InvestmentProject, (team: LacrosseTeam) => number> = {
  facilities: (team) => team.reputation.facilities,
  fans: (team) => team.reputation.fanSupport,
  academics: (team) => team.reputation.academicPrestige,
};

function InvestmentsCard({
  team,
  budget,
  plan,
  onFund,
  onUnfund,
  gate,
}: {
  team: LacrosseTeam;
  gate?: GateReceipts | undefined;
  budget: number;
  plan: InvestmentPlan;
  onFund: (project: InvestmentProject) => void;
  onUnfund: (project: InvestmentProject) => void;
}) {
  const spent = planCost(plan);
  const after = applyInvestmentPlan(team, plan);
  return (
    <article className="card investments-card" aria-label="Program investments">
      <h2>Program Investments</h2>
      <p className="dim">
        The athletic department has {budget} points for the program this year. Spend them before the season starts; unspent
        points don&apos;t carry over.
      </p>
      {gate && gate.homeGames > 0 && (
        <p className="investments-gate" aria-label="Gate receipts">
          Gate receipts: {gate.totalFans.toLocaleString('en-US')} fans over {gate.homeGames} home game{gate.homeGames === 1 ? '' : 's'}
          {gate.sellouts > 0 ? `, ${gate.sellouts} sellout${gate.sellouts === 1 ? '' : 's'}` : ''}.{' '}
          {gate.bonus > 0 ? (
            <strong>+{gate.bonus} point{gate.bonus === 1 ? '' : 's'} to the budget.</strong>
          ) : (
            <span>Not enough to add to the budget; every {GATE_FANS_PER_POINT.toLocaleString('en-US')} fans earns a point.</span>
          )}
        </p>
      )}
      <p className="investments-budget">
        <strong>{budget - spent}</strong> of {budget} points left
      </p>
      <ul className="investments-list">
        {INVESTMENT_PROJECTS.map((project) => {
          const info = INVESTMENT_PROJECT_INFO[project];
          const funded = plan[project] ?? 0;
          const canFund = fundProject(plan, project, budget) !== plan;
          const now = PROJECT_RATING[project](team);
          const next = PROJECT_RATING[project](after);
          return (
            <li key={project} aria-label={info.title}>
              <div className="investments-info">
                <strong>{info.title}</strong>
                <span className="dim">{info.effect}</span>
                <span className="investments-rating">
                  {now}
                  {next !== now && <span className="mood-happy"> → {next}</span>}
                  <span className="dim"> · {info.cost} pts for +{info.gain}</span>
                </span>
              </div>
              <div className="investments-controls">
                <button type="button" className="ghost-btn" onClick={() => onUnfund(project)} disabled={funded === 0} aria-label={`Remove ${info.title}`}>
                  −
                </button>
                <span className="investments-count">{funded}</span>
                <button type="button" className="ghost-btn" onClick={() => onFund(project)} disabled={!canFund} aria-label={`Fund ${info.title}`}>
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

function RealignmentCard({
  move,
  invite,
  userTeamId,
  teamShort,
  conferences,
  teams,
  onAnswer,
}: {
  move: RealignmentMove;
  invite: boolean;
  userTeamId: string;
  teamShort: (id: string) => string;
  conferences: Array<{ id: string; name: string; shortName: string; teamIds: string[] }>;
  teams: LacrosseTeam[];
  onAnswer: (accept: boolean) => void;
}) {
  const prestige = new Map(teams.map((t) => [t.id, t.reputation.nationalPrestige]));
  const strength = (id: string) => {
    const conference = conferences.find((c) => c.id === id);
    return conference ? Math.round(conferenceStrength(conference, (t) => prestige.get(t) ?? 0)) : 0;
  };
  const name = (id: string) => conferences.find((c) => c.id === id)?.name ?? id;
  const from = move.fromConferenceId;
  const to = move.toConferenceId;
  const pair = (ids: readonly string[]) => ids.map((id) => (id === userTeamId ? <strong key={id}>{teamShort(id)}</strong> : <span key={id}>{teamShort(id)}</span>));
  return (
    <article className="card realignment-card" aria-label="Conference realignment">
      <p className="eyebrow">Conference Realignment</p>
      <h2>{invite ? `The ${name(to)} wants you` : `${teamShort(move.risingTeamIds[0])} and ${teamShort(move.risingTeamIds[1])} move up`}</h2>
      <div className="realignment-swap">
        <div>
          <p className="section-label">Joining the {name(to)}</p>
          <p className="realignment-pair">{pair(move.risingTeamIds)}</p>
        </div>
        <div>
          <p className="section-label">Joining the {name(from)}</p>
          <p className="realignment-pair">{pair(move.fadingTeamIds)}</p>
        </div>
      </div>
      <p className="dim">
        League prestige: {name(to)} {strength(to)}, {name(from)} {strength(from)}. Rivals move together, so every trophy game stays on the schedule.
      </p>
      {invite && (
        <>
          <p>
            Joining means a tougher conference slate and a stronger RPI, plus the prestige of a bigger league for recruiting. Next season's schedule is redrawn
            around the new conference, so non-conference changes reset.
          </p>
          <div className="realignment-actions">
            <button className="offer-btn" onClick={() => onAnswer(true)}>
              Join the {name(to)}
            </button>
            <button className="ghost-btn" onClick={() => onAnswer(false)}>
              Stay in the {name(from)}
            </button>
          </div>
        </>
      )}
    </article>
  );
}
