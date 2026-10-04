import type { CarouselChange, CoachDepartureReason, LacrossePortalEntry, LacrosseTeam } from '@sports-management-sim/sport-lacrosse';
import { PORTAL_REASON_LABELS } from '@sports-management-sim/engine-core';
import { OfferControl } from '../components/OfferControl';
import { portalStanding } from './PortalBoard';
import type { OffseasonSummary } from '../dynasty-helpers';
import type { DynastySeasonRecord } from '../history';
import type { SeasonAwards } from '../awards';
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
          <h2>
            Finished #{offseasonSummary.userStanding} ·{' '}
            {offseasonSummary.userRecord.wins}–{offseasonSummary.userRecord.losses}
          </h2>
          <table className="standings-table recap-table">
            <thead>
              <tr>
                <th></th>
                <th>Team</th>
                <th>W</th>
                <th>L</th>
              </tr>
            </thead>
            <tbody>
              {offseasonSummary.finalStandings.map((entry, i) => (
                <tr
                  key={entry.teamId}
                  className={entry.teamId === userTeamId ? 'user-row' : ''}
                >
                  <td className="rank">#{i + 1}</td>
                  <td>{formatTeamName(teamMap.get(entry.teamId) ?? entry.teamId)}</td>
                  <td>{entry.record.wins}</td>
                  <td>{entry.record.losses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        {offseasonSummary.awards && (
          <AwardsSection awards={offseasonSummary.awards} />
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

function AwardsSection({ awards }: { awards: SeasonAwards }) {
  return (
    <article className="card">
      <h2>Season Awards</h2>
      <div className="awards-grid">
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
      {awards.allConference.length > 0 && (
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
