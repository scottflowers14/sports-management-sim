import type { ReactNode } from 'react';
import type { LacrosseTeam } from '@sports-management-sim/sport-lacrosse';
import type { Conference, StandingsEntry } from '@sports-management-sim/engine-core';
import type { RankingEntry } from '../rankings';
import { compareConferenceStanding, projectionStatus, type NcaaProjection } from '../tournament';
import { formatTeamName } from '../ui/format';

export function StandingsScreen({
  rankings,
  sortedStandings,
  teams,
  conferences,
  userTeamId,
  teamMap,
  onOpenProgram,
  projection = null,
}: {
  rankings: RankingEntry[];
  sortedStandings: StandingsEntry[];
  teams: LacrosseTeam[];
  conferences: Conference[];
  userTeamId: string;
  teamMap: Map<string, string>;
  onOpenProgram: (teamId: string) => void;
  /** In-season projected NCAA field; null once the postseason starts. */
  projection?: NcaaProjection | null;
}) {
  const teamLink = (teamId: string) => (
    <button type="button" className="link-btn" onClick={() => onOpenProgram(teamId)}>
      {formatTeamName(teamMap.get(teamId) ?? teamId)}
    </button>
  );

  return (
    <div className="standings-layout">
      {projection && (
        <BracketologyCard
          projection={projection}
          standings={sortedStandings}
          userTeamId={userTeamId}
          teamLink={teamLink}
        />
      )}
      <article className="card">
        <h2>National Rankings</h2>
        {rankings.length > 0 ? (
          <table className="standings-table">
            <thead>
              <tr>
                <th>#</th>
                <th></th>
                <th>Team</th>
                <th>W</th>
                <th>L</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((entry) => {
                const change = entry.previousRank - entry.rank;
                const team = teams.find((t) => t.id === entry.teamId);
                const standing = sortedStandings.find((s) => s.teamId === entry.teamId);
                return (
                  <tr
                    key={entry.teamId}
                    className={entry.teamId === userTeamId ? 'user-row' : ''}
                  >
                    <td className="rank">#{entry.rank}</td>
                    <td>
                      {change > 0 ? (
                        <span className="rank-change rank-up">▲{change}</span>
                      ) : change < 0 ? (
                        <span className="rank-change rank-down">▼{Math.abs(change)}</span>
                      ) : (
                        <span className="rank-change rank-same">—</span>
                      )}
                    </td>
                    <td>
                      {teamLink(entry.teamId)}
                      {team && (
                        <span className="prestige-pip" title={`Prestige ${team.reputation.nationalPrestige}`}>
                          {' '}
                          <span className="prestige-dots">
                            {'●'.repeat(Math.ceil(team.reputation.nationalPrestige / 20)).slice(0, 5)}
                          </span>
                        </span>
                      )}
                    </td>
                    <td>{standing?.record.wins ?? 0}</td>
                    <td>{standing?.record.losses ?? 0}</td>
                    <td>{entry.score}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="dim">Sim some games to see rankings</p>
        )}
      </article>

      <div className="conf-group">
        {conferences.map((conf) => {
          // League tables order by conference record, the same order the tournament seeds by.
          const confStandings = sortedStandings
            .filter((s) => teams.find((t) => t.id === s.teamId)?.conferenceId === conf.id)
            .sort(compareConferenceStanding);
          if (confStandings.length === 0) return null;
          return (
            <article key={conf.id} className="card">
              <h2>{conf.id.toUpperCase()} Standings</h2>
              <table className="standings-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Team</th>
                    <th>W</th>
                    <th>L</th>
                    <th>Conf W–L</th>
                  </tr>
                </thead>
                <tbody>
                  {confStandings.map((entry, i) => (
                    <tr
                      key={entry.teamId}
                      className={entry.teamId === userTeamId ? 'user-row' : ''}
                    >
                      <td className="rank">#{i + 1}</td>
                      <td>{teamLink(entry.teamId)}</td>
                      <td>{entry.record.wins}</td>
                      <td>{entry.record.losses}</td>
                      <td>{entry.record.conferenceWins}–{entry.record.conferenceLosses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function BracketologyCard({
  projection,
  standings,
  userTeamId,
  teamLink,
}: {
  projection: NcaaProjection;
  standings: StandingsEntry[];
  userTeamId: string;
  teamLink: (teamId: string) => ReactNode;
}) {
  const record = (teamId: string) => {
    const r = standings.find((s) => s.teamId === teamId)?.record;
    return r ? `${r.wins}–${r.losses}` : '0–0';
  };
  return (
    <article className="card bracketology-card" aria-label="Bracketology">
      <div className="card-head-row">
        <h2>Bracketology</h2>
        <span className={`bracket-status${projection.field.some((e) => e.teamId === userTeamId) ? ' bracket-in' : ''}`}>
          You: {projectionStatus(projection, userTeamId)}
        </span>
      </div>
      <p className="dim bracket-note">
        If the season ended today. Conference leaders take the auto bids; the rest go by RPI.
      </p>
      <table className="standings-table">
        <thead>
          <tr>
            <th>Seed</th>
            <th>Team</th>
            <th>Bid</th>
            <th>W-L</th>
            <th>RPI</th>
          </tr>
        </thead>
        <tbody>
          {projection.field.map((e) => (
            <tr key={e.teamId} className={e.teamId === userTeamId ? 'user-row' : ''}>
              <td className="rank">{e.seed}</td>
              <td>{teamLink(e.teamId)}</td>
              <td>{e.bid === 'auto' ? <span className="honor-pill">AQ</span> : <span className="dim">At-large</span>}</td>
              <td>{record(e.teamId)}</td>
              <td>{e.rpi.toFixed(3).replace(/^0/, '')}</td>
            </tr>
          ))}
          {projection.firstOut.length > 0 && (
            <tr className="bracket-divider">
              <td colSpan={5} className="section-label">First Four Out</td>
            </tr>
          )}
          {projection.firstOut.map((e) => (
            <tr key={e.teamId} className={e.teamId === userTeamId ? 'user-row dim' : 'dim'}>
              <td className="rank">—</td>
              <td>{teamLink(e.teamId)}</td>
              <td />
              <td>{record(e.teamId)}</td>
              <td>{e.rpi.toFixed(3).replace(/^0/, '')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}
