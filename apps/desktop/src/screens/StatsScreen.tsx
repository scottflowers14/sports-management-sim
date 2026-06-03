import { useState } from 'react';
import type { SeasonStatsMap, PlayerSeasonStats } from '../stats';
import { formatTeamShort } from '../ui/format';

type StatCategory = 'scoring' | 'goalkeeping' | 'faceoffs' | 'defense';

type StatColumn =
  | { label: string; key: keyof PlayerSeasonStats }
  | { label: string; compute: (s: PlayerSeasonStats) => number };

export function StatsScreen({
  seasonStats,
  playerLookup,
  userTeamId,
}: {
  seasonStats: SeasonStatsMap;
  playerLookup: Map<string, { name: string; teamName: string; position: string; teamId: string }>;
  userTeamId: string;
}) {
  const [category, setCategory] = useState<StatCategory>('scoring');

  const allStats = Object.values(seasonStats).filter((s) => s.gamesPlayed > 0);

  if (allStats.length === 0) {
    return (
      <article className="card">
        <h2>Season Stats</h2>
        <p className="dim">Sim some games to populate stat leaders.</p>
      </article>
    );
  }

  const categories: StatCategory[] = ['scoring', 'goalkeeping', 'faceoffs', 'defense'];

  return (
    <div className="stats-layout">
      <div className="stats-cat-bar">
        {categories.map((cat) => (
          <button
            key={cat}
            className={category === cat ? 'stat-cat-btn active' : 'stat-cat-btn'}
            onClick={() => setCategory(cat)}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {category === 'scoring' && (
        <StatTable
          title="Scoring Leaders"
          rows={allStats
            .filter((s) => {
              const info = playerLookup.get(s.playerId);
              return info?.position === 'ATT' || info?.position === 'MID';
            })
            .sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists))
            .slice(0, 15)}
          columns={[
            { label: 'G', key: 'goals' },
            { label: 'A', key: 'assists' },
            { label: 'PTS', compute: (s) => s.goals + s.assists },
            { label: 'SH', key: 'shots' },
            { label: 'GP', key: 'gamesPlayed' },
          ]}
          playerLookup={playerLookup}
          userTeamId={userTeamId}
        />
      )}

      {category === 'goalkeeping' && (
        <StatTable
          title="Goalkeeping Leaders"
          rows={allStats
            .filter((s) => {
              const info = playerLookup.get(s.playerId);
              return info?.position === 'GK';
            })
            .sort((a, b) => b.saves - a.saves)
            .slice(0, 10)}
          columns={[
            { label: 'SV', key: 'saves' },
            { label: 'GA', key: 'goalsAllowed' },
            { label: 'SV%', compute: (s) => s.saves + s.goalsAllowed > 0 ? Math.round(s.saves / (s.saves + s.goalsAllowed) * 100) : 0 },
            { label: 'GP', key: 'gamesPlayed' },
          ]}
          playerLookup={playerLookup}
          userTeamId={userTeamId}
        />
      )}

      {category === 'faceoffs' && (
        <StatTable
          title="Faceoff Leaders"
          rows={allStats
            .filter((s) => s.faceoffAttempts > 0)
            .sort((a, b) => b.faceoffWins - a.faceoffWins)
            .slice(0, 10)}
          columns={[
            { label: 'FW', key: 'faceoffWins' },
            { label: 'FA', key: 'faceoffAttempts' },
            { label: 'FO%', compute: (s) => s.faceoffAttempts > 0 ? Math.round(s.faceoffWins / s.faceoffAttempts * 100) : 0 },
            { label: 'GP', key: 'gamesPlayed' },
          ]}
          playerLookup={playerLookup}
          userTeamId={userTeamId}
        />
      )}

      {category === 'defense' && (
        <StatTable
          title="Defensive Leaders"
          rows={allStats
            .filter((s) => {
              const info = playerLookup.get(s.playerId);
              return info?.position === 'DEF' || info?.position === 'LSM';
            })
            .sort((a, b) => (b.causedTurnovers + b.groundBalls) - (a.causedTurnovers + a.groundBalls))
            .slice(0, 15)}
          columns={[
            { label: 'CT', key: 'causedTurnovers' },
            { label: 'GB', key: 'groundBalls' },
            { label: 'TO', key: 'turnovers' },
            { label: 'GP', key: 'gamesPlayed' },
          ]}
          playerLookup={playerLookup}
          userTeamId={userTeamId}
        />
      )}
    </div>
  );
}

function StatTable({
  title,
  rows,
  columns,
  playerLookup,
  userTeamId,
}: {
  title: string;
  rows: PlayerSeasonStats[];
  columns: StatColumn[];
  playerLookup: Map<string, { name: string; teamName: string; position: string; teamId: string }>;
  userTeamId: string;
}) {
  if (rows.length === 0) {
    return (
      <article className="card">
        <h2>{title}</h2>
        <p className="dim">No data yet</p>
      </article>
    );
  }

  return (
    <article className="card">
      <h2>{title}</h2>
      <table className="standings-table stats-table">
        <thead>
          <tr>
            <th></th>
            <th>Player</th>
            <th>Team</th>
            {columns.map((col) => <th key={col.label}>{col.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const info = playerLookup.get(row.playerId);
            const isUser = info?.teamId === userTeamId;
            return (
              <tr key={row.playerId} className={isUser ? 'user-row' : ''}>
                <td className="rank">#{i + 1}</td>
                <td>{info?.name ?? '—'}</td>
                <td className="stats-team">{info ? formatTeamShort(info.teamName) : '—'}</td>
                {columns.map((col) => (
                  <td key={col.label} className="stat-val">
                    {'key' in col
                      ? String(row[col.key])
                      : String(col.compute(row))}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </article>
  );
}
