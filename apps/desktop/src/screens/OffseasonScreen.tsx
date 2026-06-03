import type { LacrossePortalEntry, LacrosseTeam } from '@sports-management-sim/sport-lacrosse';
import type { OffseasonSummary } from '../dynasty-helpers';
import type { DynastySeasonRecord } from '../history';
import type { SeasonAwards } from '../awards';
import { formatTeamName } from '../ui/format';

export function OffseasonScreen({
  offseasonSummary,
  userTeam,
  portalEntries,
  teamMap,
  dynastyHistory,
  seasonYear,
  userTeamId,
  onStartNewSeason,
  onOfferPortalPlayer,
}: {
  offseasonSummary: OffseasonSummary;
  userTeam: LacrosseTeam;
  portalEntries: LacrossePortalEntry[];
  teamMap: Map<string, string>;
  dynastyHistory: DynastySeasonRecord[];
  seasonYear: number;
  userTeamId: string;
  onStartNewSeason: () => void;
  onOfferPortalPlayer: (entryId: string) => void;
}) {
  const availablePortal = portalEntries.filter((e) => e.status === 'available');

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
        </article>

        {availablePortal.length > 0 && (
          <article className="card portal-offseason-card">
            <h2>Transfer Portal · {availablePortal.length} Available</h2>
            <p className="portal-hint">Make offers before starting the season. Portal resolves when you begin.</p>
            <div className="portal-mini-list">
              {availablePortal.slice(0, 8).map((entry) => {
                const hasOffer = entry.offersByTeamId[userTeamId] !== undefined;
                return (
                  <div key={entry.id} className="portal-mini-row">
                    <span className="portal-mini-name">
                      {entry.name.first} {entry.name.last}
                    </span>
                    <span className="portal-mini-meta">
                      {entry.classYear} {entry.position} · {entry.ratings.overall} OVR
                    </span>
                    {hasOffer ? (
                      <span className="badge badge-offered">Offered</span>
                    ) : (
                      <button className="offer-btn offer-btn-sm" onClick={() => onOfferPortalPlayer(entry.id)}>
                        Offer
                      </button>
                    )}
                  </div>
                );
              })}
              {availablePortal.length > 8 && (
                <p className="dim">+{availablePortal.length - 8} more in portal</p>
              )}
            </div>
          </article>
        )}

        <button className="sim-btn new-season-btn" onClick={onStartNewSeason}>
          Start {seasonYear} Season →
        </button>
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
              {winner.position} · {formatTeamName(winner.teamName)} · {winner.overall} OVR
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
                <th>Player</th><th>Pos</th><th>Team</th><th>OVR</th>
              </tr>
            </thead>
            <tbody>
              {awards.allConference.map((winner, i) => (
                <tr key={i}>
                  <td>{winner.playerName}</td>
                  <td>{winner.position}</td>
                  <td>{formatTeamName(winner.teamName)}</td>
                  <td>{winner.overall}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </article>
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
