import type { LacrosseTeam } from '@sports-management-sim/sport-lacrosse';
import type { Conference, StandingsEntry } from '@sports-management-sim/engine-core';
import type { RankingEntry } from '../rankings';
import { formatTeamName } from '../ui/format';

export function StandingsScreen({
  rankings,
  sortedStandings,
  teams,
  conferences,
  userTeamId,
  teamMap,
}: {
  rankings: RankingEntry[];
  sortedStandings: StandingsEntry[];
  teams: LacrosseTeam[];
  conferences: Conference[];
  userTeamId: string;
  teamMap: Map<string, string>;
}) {
  return (
    <div className="standings-layout">
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
                      {formatTeamName(teamMap.get(entry.teamId) ?? entry.teamId)}
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
          const confStandings = sortedStandings.filter((s) => {
            const team = teams.find((t) => t.id === s.teamId);
            return team?.conferenceId === conf.id;
          });
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
                      <td>{formatTeamName(teamMap.get(entry.teamId) ?? entry.teamId)}</td>
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
