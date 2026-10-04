import { useMemo, useState } from 'react';
import type { LacrosseTeam } from '@sports-management-sim/sport-lacrosse';
import type { CareerStatsMap } from '../career-stats';
import {
  careersWithLiveSeason,
  LEAGUE_SCOPE,
  RECORD_STATS,
  scopeRecords,
  type RecordBookArchive,
  type RecordEntry,
  type RecordKind,
} from '../records';
import type { SeasonStatsMap } from '../stats';
import { formatTeamName, formatTeamShort } from '../ui/format';

interface RecordsScreenProps {
  archive: RecordBookArchive;
  careers: CareerStatsMap;
  seasonStats: SeasonStatsMap;
  teams: LacrosseTeam[];
  seasonYear: number;
  userTeamName: string;
  onSelectPlayer: (playerId: string) => void;
}

function years(entry: RecordEntry): string {
  return entry.firstYear === entry.lastYear ? `${entry.firstYear}` : `${entry.firstYear}–${entry.lastYear}`;
}

export function RecordsScreen({ archive, careers, seasonStats, teams, seasonYear, userTeamName, onSelectPlayer }: RecordsScreenProps) {
  const [scope, setScope] = useState<string>(userTeamName);
  const [kind, setKind] = useState<RecordKind>('season');
  const activeIds = useMemo(() => new Set(teams.flatMap((t) => t.roster.map((p) => p.id))), [teams]);
  const records = useMemo(
    () => scopeRecords(archive, scope, careersWithLiveSeason(careers, seasonStats, teams, seasonYear), seasonYear),
    [archive, scope, careers, seasonStats, teams, seasonYear],
  );
  const isLeague = scope === LEAGUE_SCOPE;
  const empty = RECORD_STATS.every(({ key }) => (records[kind][key] ?? []).length === 0);

  return (
    <div className="records-layout">
      <article className="card records-header">
        <div>
          <p className="eyebrow">Record book</p>
          <h2>{isLeague ? 'League Records' : `${formatTeamName(userTeamName)} Records`}</h2>
          <p className="dim">
            The best seasons and careers since the dynasty began. Players in green are still active, and this season
            counts as it's played.
          </p>
        </div>
        <div className="records-controls">
          <div className="stats-cat-bar" role="group" aria-label="Records scope">
            <button type="button" className={!isLeague ? 'stat-cat-btn active' : 'stat-cat-btn'} onClick={() => setScope(userTeamName)}>
              Program
            </button>
            <button type="button" className={isLeague ? 'stat-cat-btn active' : 'stat-cat-btn'} onClick={() => setScope(LEAGUE_SCOPE)}>
              League
            </button>
          </div>
          <div className="stats-cat-bar" role="group" aria-label="Record type">
            <button type="button" className={kind === 'season' ? 'stat-cat-btn active' : 'stat-cat-btn'} onClick={() => setKind('season')}>
              Single Season
            </button>
            <button type="button" className={kind === 'career' ? 'stat-cat-btn active' : 'stat-cat-btn'} onClick={() => setKind('career')}>
              Career
            </button>
          </div>
        </div>
      </article>

      {empty ? (
        <article className="card">
          <p className="dim">Sim some games to start the record book.</p>
        </article>
      ) : (
        <div className="records-grid">
          {RECORD_STATS.map(({ key, label }) => {
            const entries = records[kind][key] ?? [];
            return (
              <article key={key} className="card records-card" aria-label={`${label} records`}>
                <h3>{label}</h3>
                {entries.length === 0 ? (
                  <p className="dim">No record yet.</p>
                ) : (
                  <table className="standings-table records-table">
                    <tbody>
                      {entries.map((entry, i) => {
                        const active = activeIds.has(entry.playerId);
                        return (
                          <tr key={`${entry.playerId}-${entry.firstYear}-${entry.teamName}`} className={i === 0 ? 'records-holder' : undefined}>
                            <td className="records-rank">{i + 1}</td>
                            <td>
                              {active ? (
                                <button type="button" className="practice-name-btn records-active" onClick={() => onSelectPlayer(entry.playerId)}>
                                  {entry.name}
                                </button>
                              ) : (
                                <span>{entry.name}</span>
                              )}
                              {entry.inProgress && <span className="records-live">Live</span>}
                              <div className="dim records-meta">
                                {entry.position}
                                {isLeague ? ` · ${formatTeamShort(entry.teamName)}` : ''} · {years(entry)}
                              </div>
                            </td>
                            <td className="records-value">{entry.value}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
