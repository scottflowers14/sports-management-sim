import { useState } from 'react';
import {
  NIL_PORTAL_INTEREST_BOOST,
  NIL_RETENTION_ODDS,
  formatNil,
  nilDealFor,
  nilPortalDealCost,
  nilRemaining,
  nilRetentionAsk,
  type LacrossePortalEntry,
  type LacrossePosition,
  type LacrosseTeam,
  type NilState,
} from '@sports-management-sim/sport-lacrosse';
import { PORTAL_REASON_LABELS, rankPortalCandidates } from '@sports-management-sim/engine-core';
import { OfferControl } from '../components/OfferControl';
import { RatingCell } from '../components/RatingCell';
import { SortHeader, nextSort, type SortState } from '../components/SortHeader';
import { formatTeamName, formatTeamShort } from '../ui/format';

const POSITIONS: Array<LacrossePosition | 'ALL'> = ['ALL', 'ATT', 'MID', 'DEF', 'LSM', 'GK', 'FOGO'];
const REASON_SHORT: Record<LacrossePortalEntry['reason'], string> = {
  playing_time: 'Playing time',
  bigger_stage: 'Bigger stage',
  closer_to_home: 'Near home',
  scholarship: 'Scholarship',
};
type PortalSortKey = 'name' | 'position' | 'classYear' | 'overall' | 'potential' | 'offers' | 'from';
const ASCENDING_FIRST: ReadonlySet<PortalSortKey> = new Set(['name', 'position', 'classYear', 'from']);

export interface PortalNilProps {
  state: NilState;
  onRetain: (entryId: string) => void;
  onDeal: (entryId: string) => void;
}

export interface PortalBoardProps {
  entries: LacrossePortalEntry[];
  teams: LacrosseTeam[];
  userTeamId: string;
  teamMap: Map<string, string>;
  seasonYear: number;
  /** Scholarship equivalencies still free to promise. */
  scholarshipRoom: number;
  onOffer: (entryId: string, scholarshipPercent: number) => void;
  onWithdraw: (entryId: string) => void;
  nil?: PortalNilProps;
}

/** Who a transfer is leaning toward right now, and where our offer stands. */
export function portalStanding(entry: LacrossePortalEntry, teams: LacrosseTeam[], userTeamId: string) {
  const ranked = rankPortalCandidates(entry, teams);
  const leader = ranked[0];
  const ours = ranked.findIndex((r) => r.teamId === userTeamId);
  return {
    leaderTeamId: leader?.teamId,
    ourRank: ours === -1 ? null : ours + 1,
    ourScore: ours === -1 ? null : ranked[ours]!.score,
    leaderScore: leader?.score ?? null,
    playersAhead: ranked.find((r) => r.teamId === userTeamId)?.playersAhead ?? null,
  };
}

export function PortalBoard({ entries, teams, userTeamId, teamMap, seasonYear, scholarshipRoom, onOffer, onWithdraw, nil }: PortalBoardProps) {
  const [position, setPosition] = useState<LacrossePosition | 'ALL'>('ALL');
  const [onlyOurs, setOnlyOurs] = useState(false);
  const [sort, setSort] = useState<SortState<PortalSortKey>>({ key: 'overall', direction: 'desc' });

  const available = entries.filter((e) => e.status === 'available');
  const ourDepartures = available.filter((e) => e.sourceTeamId === userTeamId);
  const ourOffers = available.filter((e) => e.offersByTeamId[userTeamId] !== undefined);
  const userTeam = teams.find((t) => t.id === userTeamId);
  const nilLeft = nil ? nilRemaining(nil.state) : 0;
  const declinedNil = nil ? nil.state.deals.filter((d) => d.kind === 'retain' && d.outcome === 'declined').map((d) => d.entryId) : [];
  const keptNil = nil ? nil.state.deals.filter((d) => d.outcome === 'retained').length : 0;

  const rows = (() => {
    const filtered = available.filter(
      (e) => (position === 'ALL' || e.position === position) && (!onlyOurs || e.offersByTeamId[userTeamId] !== undefined),
    );
    const dir = sort.direction === 'asc' ? 1 : -1;
    const key = (e: LacrossePortalEntry): string | number => {
      switch (sort.key) {
        case 'name': return `${e.name.last} ${e.name.first}`;
        case 'position': return e.position;
        case 'classYear': return ['FR', 'SO', 'JR', 'SR', 'GR'].indexOf(e.classYear);
        case 'overall': return e.ratings.overall;
        case 'potential': return e.ratings.potential;
        case 'offers': return Object.keys(e.offersByTeamId).length;
        case 'from': return teamMap.get(e.sourceTeamId) ?? e.sourceTeamId;
      }
    };
    return [...filtered].sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      const cmp = typeof ka === 'number' && typeof kb === 'number' ? ka - kb : String(ka).localeCompare(String(kb));
      return cmp * dir || b.ratings.overall - a.ratings.overall;
    });
  })();

  const onSort = (column: PortalSortKey) => setSort((s) => nextSort(s, column, ASCENDING_FIRST.has(column) ? 'asc' : 'desc'));
  const h = (label: string, column: PortalSortKey, title?: string) => (
    <SortHeader label={label} column={column} sort={sort} onSort={onSort} {...(title ? { title } : {})} />
  );
  const teamName = (id: string) => formatTeamName(teamMap.get(id) ?? id);
  const teamShort = (id: string) => formatTeamShort(teamMap.get(id) ?? id);

  if (entries.length === 0) {
    return (
      <article className="card">
        <h2>Transfer Portal</h2>
        <p className="dim">The portal opens after the season, once rosters turn over. Check back in the offseason.</p>
      </article>
    );
  }

  if (available.length === 0) {
    return <PortalResults entries={entries} userTeamId={userTeamId} teamMap={teamMap} seasonYear={seasonYear} />;
  }

  return (
    <div className="portal-layout">
      <article className="card dense-card portal-board-card" aria-label="Transfer portal">
        <div className="screen-toolbar">
          <div>
            <p className="eyebrow">Portal for the {seasonYear} season</p>
            <h2>Transfer Portal</h2>
          </div>
          <div className="portal-stats" aria-label="Portal summary">
            <span><strong>{available.length}</strong> in the portal</span>
            <span><strong>{ourOffers.length}</strong> our offers</span>
            <span><strong>{scholarshipRoom.toFixed(2)}</strong> scholarships free</span>
            {nil && <span title="NIL collective money left this offseason"><strong>{formatNil(nilLeft)}</strong> NIL left</span>}
          </div>
          <label className="toolbar-field">
            Position
            <select value={position} onChange={(e) => setPosition(e.target.value as LacrossePosition | 'ALL')} aria-label="Filter portal by position">
              {POSITIONS.map((p) => <option key={p} value={p}>{p === 'ALL' ? 'All' : p}</option>)}
            </select>
          </label>
          <label className="toolbar-check">
            <input type="checkbox" checked={onlyOurs} onChange={(e) => setOnlyOurs(e.target.checked)} />
            Our offers only
          </label>
        </div>
        <p className="portal-hint">
          Transfers weigh playing time, prestige, home region and the scholarship on the table. Everyone picks a school when the season starts.
        </p>

        {nil && (
          <p className="portal-hint nil-hint">
            NIL collective: {formatNil(nilLeft)} of {formatNil(nil.state.budget)} left. Pay one of our departures to stay
            (it lands or fails on the spot, and a no costs nothing), or add NIL to a portal offer for +{NIL_PORTAL_INTEREST_BOOST} interest.
            {keptNil > 0 ? ` Kept ${keptNil} so far.` : ''}
          </p>
        )}

        {ourDepartures.length > 0 && (
          <div className="portal-departures" aria-label="Our players in the portal">
            <p className="section-label">Our players in the portal · {ourDepartures.length}</p>
            <ul className="portal-departure-list">
              {ourDepartures.map((e) => {
                const rivals = Object.keys(e.offersByTeamId).filter((id) => id !== userTeamId);
                const ourOffer = e.offersByTeamId[userTeamId];
                return (
                  <li key={e.id} className="portal-departure-row">
                    <span className="portal-departure-name">{e.name.first} {e.name.last}</span>
                    <span className="portal-departure-meta">
                      {e.classYear} {e.position} · <RatingCell value={e.ratings.overall} /> OVR · {PORTAL_REASON_LABELS[e.reason]}
                    </span>
                    <span className="portal-departure-rivals">
                      {rivals.length > 0 ? `Offers from ${rivals.map(teamShort).join(', ')}` : 'No other offers yet'}
                    </span>
                    <span className="portal-departure-actions">
                    {ourOffer !== undefined ? (
                      <span className="badge badge-offered">Re-recruiting {ourOffer}%</span>
                    ) : (
                      <OfferControl recruitId={e.id} recruitName={`${e.name.first} ${e.name.last}`} budgetRemaining={scholarshipRoom} onOffer={onOffer} label="Re-recruit" />
                    )}
                    {nil && (declinedNil.includes(e.id) ? (
                      <span className="badge nil-declined">Turned down NIL</span>
                    ) : (
                      <button
                        className="ghost-btn nil-btn"
                        disabled={nilRetentionAsk(e) > nilLeft}
                        onClick={() => nil.onRetain(e.id)}
                        aria-label={`NIL deal to keep ${e.name.first} ${e.name.last}`}
                        title={`${Math.round(NIL_RETENTION_ODDS[e.reason] * 100)}% chance he takes it`}
                      >
                        NIL {formatNil(nilRetentionAsk(e))} · {Math.round(NIL_RETENTION_ODDS[e.reason] * 100)}%
                      </button>
                    ))}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="portal-table-wrap">
        <table className="standings-table portal-table">
          <thead>
            <tr>
              {h('Player', 'name')}
              {h('Pos', 'position')}
              {h('Cls', 'classYear')}
              {h('OVR', 'overall')}
              {h('POT', 'potential')}
              <th title="Seasons of eligibility left">Yrs</th>
              {h('From', 'from')}
              <th>Why</th>
              <th title="Players on our roster at this position rated at or above the transfer">Ahead</th>
              {h('Offers', 'offers', 'Programs with an offer out; the one the player is leaning toward is highlighted')}
              <th>Our offer</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const ourOffer = e.offersByTeamId[userTeamId];
              const rivals = Object.keys(e.offersByTeamId).filter((id) => id !== userTeamId);
              const standing = portalStanding(e, teams, userTeamId);
              const ahead = userTeam
                ? userTeam.roster.filter((p) => p.position === e.position && p.ratings.overall >= e.ratings.overall).length
                : null;
              return (
                <tr key={e.id} className={ourOffer !== undefined ? 'portal-row-offered' : e.sourceTeamId === userTeamId ? 'portal-row-ours' : ''}>
                  <td className="portal-name">
                    <span className="portal-name-text">{e.name.first} {e.name.last}</span>
                    {e.sourceTeamId === userTeamId && <span className="portal-tag">ours</span>}
                  </td>
                  <td>{e.position}</td>
                  <td>{e.classYear}</td>
                  <td><RatingCell value={e.ratings.overall} /></td>
                  <td><RatingCell value={e.ratings.potential} /></td>
                  <td>{e.eligibility.seasonsRemaining}</td>
                  <td className="portal-from" title={teamName(e.sourceTeamId)}>{teamShort(e.sourceTeamId)}</td>
                  <td className="portal-reason" title={PORTAL_REASON_LABELS[e.reason]}>{REASON_SHORT[e.reason]}</td>
                  <td className={ahead === 0 ? 'portal-ahead-open' : ''}>{ahead ?? '–'}</td>
                  <td className="portal-offers">
                    {rivals.length === 0 ? (
                      <span className="dim">{ourOffer === undefined ? 'none' : 'just us'}</span>
                    ) : (
                      <div className="competitor-row">
                        {rivals.map((id) => (
                          <span
                            key={id}
                            className={`competitor-chip${standing.leaderTeamId === id ? ' competitor-leader' : ''}`}
                            title={`${teamName(id)} offered ${e.offersByTeamId[id]}%${standing.leaderTeamId === id ? ' (leaning this way)' : ''}`}
                          >
                            {teamShort(id)}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="portal-action">
                    {ourOffer !== undefined ? (
                      <div className="portal-offer-state">
                        <span className="badge badge-offered">{ourOffer}%</span>
                        {standing.ourRank === 1 ? (
                          <span className="portal-leading">Leading</span>
                        ) : (
                          <span className="portal-trailing">Behind {standing.leaderTeamId ? teamShort(standing.leaderTeamId) : '–'}</span>
                        )}
                        {nil && (nilDealFor(nil.state, e.id) ? (
                          <span className="badge nil-signed" title="NIL deal attached">+NIL</span>
                        ) : (
                          <button
                            className="link-btn"
                            disabled={nilPortalDealCost(e) > nilLeft}
                            onClick={() => nil.onDeal(e.id)}
                            aria-label={`Add NIL to offer for ${e.name.first} ${e.name.last}`}
                            title={`+${NIL_PORTAL_INTEREST_BOOST} interest`}
                          >
                            +NIL {formatNil(nilPortalDealCost(e))}
                          </button>
                        ))}
                        <button className="link-btn" onClick={() => onWithdraw(e.id)} aria-label={`Withdraw offer to ${e.name.first} ${e.name.last}`}>Withdraw</button>
                      </div>
                    ) : (
                      <OfferControl recruitId={e.id} recruitName={`${e.name.first} ${e.name.last}`} budgetRemaining={scholarshipRoom} onOffer={onOffer} />
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={11} className="dim">No portal players match these filters.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </article>
    </div>
  );
}

/** Where everyone in this year's portal ended up, our moves first. */
export function PortalResults({
  entries,
  userTeamId,
  teamMap,
  seasonYear,
}: {
  entries: LacrossePortalEntry[];
  userTeamId: string;
  teamMap: Map<string, string>;
  seasonYear: number;
}) {
  const teamShort = (id: string) => formatTeamShort(teamMap.get(id) ?? id);
  const involvesUs = (e: LacrossePortalEntry) => e.sourceTeamId === userTeamId || e.committedTeamId === userTeamId;
  const ordered = [...entries].sort((a, b) => Number(involvesUs(b)) - Number(involvesUs(a)) || b.ratings.overall - a.ratings.overall);
  const arrivals = entries.filter((e) => e.status === 'committed' && e.committedTeamId === userTeamId);
  const losses = entries.filter((e) => e.sourceTeamId === userTeamId && e.status === 'committed' && e.committedTeamId !== userTeamId);
  const outcome = (e: LacrossePortalEntry) => {
    if (e.status === 'committed' && e.committedTeamId !== undefined) return `→ ${teamShort(e.committedTeamId)}`;
    if (e.player.isWalkOn) return 'Left for a smaller program';
    return `Returned to ${teamShort(e.sourceTeamId)}`;
  };

  return (
    <article className="card dense-card" aria-label="Transfer portal results">
      <div className="screen-toolbar">
        <div>
          <p className="eyebrow">{seasonYear} Portal Closed</p>
          <h2>Portal Results</h2>
        </div>
        <div className="portal-stats">
          <span><strong>{arrivals.length}</strong> joined us</span>
          <span><strong>{losses.length}</strong> left us</span>
          <span><strong>{entries.filter((e) => e.status === 'committed').length}</strong> of {entries.length} transferred</span>
        </div>
      </div>
      <table className="standings-table portal-table">
        <thead>
          <tr><th>Player</th><th>Pos</th><th>Cls</th><th>OVR</th><th>From</th><th>Why</th><th>Outcome</th></tr>
        </thead>
        <tbody>
          {ordered.map((e) => (
            <tr key={e.id} className={involvesUs(e) ? (e.committedTeamId === userTeamId ? 'portal-row-offered' : 'portal-row-ours') : ''}>
              <td className="portal-name">{e.name.first} {e.name.last}</td>
              <td>{e.position}</td>
              <td>{e.classYear}</td>
              <td><RatingCell value={e.ratings.overall} /></td>
              <td>{teamShort(e.sourceTeamId)}</td>
              <td className="portal-reason">{REASON_SHORT[e.reason]}</td>
              <td>{outcome(e)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}
