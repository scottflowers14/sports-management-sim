import { useMemo, useState } from 'react';
import {
  TEAM_STAT_KEYS,
  TEAM_STAT_LABELS,
  lowerIsBetter,
  sortTeamStats,
  splitGames,
  splitWinPct,
  teamSplits,
  teamStatHighlights,
  teamStatRankings,
} from '@sports-management-sim/sport-lacrosse';
import type { TeamStatKey } from '@sports-management-sim/sport-lacrosse';
import type { LacrosseSeason, Rivalry } from '@sports-management-sim/sport-lacrosse';
import { AWARD_RACE_KEYS, AWARD_RACE_LABELS, computeAwardsRace } from '../awards';
import type { SeasonStatsMap, PlayerSeasonStats } from '../stats';
import { formatTeamShort } from '../ui/format';
import { TEAM_STAT_SHORT, formatTeamStat } from '../ui/team-stat-format';
import { WEEKLY_HONOR_LABELS, weeklyHonorCounts } from '../weekly-honors';
import type { WeeklyHonor } from '../weekly-honors';

type StatCategory = 'scoring' | 'goalkeeping' | 'faceoffs' | 'defense' | 'awards' | 'team' | 'splits';

const CATEGORY_LABELS: Record<StatCategory, string> = {
  scoring: 'Scoring',
  goalkeeping: 'Goalkeeping',
  faceoffs: 'Faceoffs',
  defense: 'Defense',
  awards: 'Awards Race',
  team: 'Team Stats',
  splits: 'Team Splits',
};

type StatColumn =
  | { label: string; key: keyof PlayerSeasonStats }
  | { label: string; compute: (s: PlayerSeasonStats) => number };

export function StatsScreen({
  seasonStats,
  playerLookup,
  userTeamId,
  season,
  weeklyHonors = [],
  rivalries = [],
}: {
  seasonStats: SeasonStatsMap;
  playerLookup: Map<string, { name: string; teamName: string; position: string; teamId: string }>;
  userTeamId: string;
  season?: LacrosseSeason;
  weeklyHonors?: WeeklyHonor[];
  rivalries?: Rivalry[];
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

  const categories: StatCategory[] = season
    ? ['scoring', 'goalkeeping', 'faceoffs', 'defense', 'awards', 'team', 'splits']
    : ['scoring', 'goalkeeping', 'faceoffs', 'defense'];

  return (
    <div className="stats-layout">
      <div className="stats-cat-bar">
        {categories.map((cat) => (
          <button
            key={cat}
            className={category === cat ? 'stat-cat-btn active' : 'stat-cat-btn'}
            onClick={() => setCategory(cat)}
          >
            {CATEGORY_LABELS[cat]}
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

      {category === 'awards' && season && (
        <AwardsRaceView
          season={season}
          seasonStats={seasonStats}
          weeklyHonors={weeklyHonors}
          playerLookup={playerLookup}
          userTeamId={userTeamId}
        />
      )}

      {category === 'team' && season && <TeamStatsPanel season={season} userTeamId={userTeamId} />}

      {category === 'splits' && season && (
        <TeamSplitsPanel season={season} userTeamId={userTeamId} rivalries={rivalries} />
      )}
    </div>
  );
}

function AwardsRaceView({
  season,
  seasonStats,
  weeklyHonors,
  playerLookup,
  userTeamId,
}: {
  season: LacrosseSeason;
  seasonStats: SeasonStatsMap;
  weeklyHonors: WeeklyHonor[];
  playerLookup: Map<string, { name: string; teamName: string; position: string; teamId: string }>;
  userTeamId: string;
}) {
  const honorCounts = useMemo(() => weeklyHonorCounts(weeklyHonors), [weeklyHonors]);
  const race = useMemo(() => computeAwardsRace(season, seasonStats, honorCounts), [season, seasonStats, honorCounts]);
  const recentHonors = [...weeklyHonors].reverse();

  return (
    <div className="awards-race">
      <p className="dim awards-race-note">
        Where the voting stands today. Whoever leads each race after the final week takes the award.
      </p>
      <div className="awards-race-grid">
        {AWARD_RACE_KEYS.map((key) => {
          const entries = race[key];
          return (
            <article key={key} className="card" aria-label={`${AWARD_RACE_LABELS[key]} race`}>
              <h2>{AWARD_RACE_LABELS[key]}</h2>
              {entries.length === 0 ? (
                <p className="dim">No candidates yet.</p>
              ) : (
                <ol className="awards-race-list">
                  {entries.map((entry, i) => (
                    <li key={entry.playerId} className={entry.teamId === userTeamId ? 'user-row' : ''}>
                      <span className="rank">{i === 0 ? 'Leader' : `#${i + 1}`}</span>
                      <span className="awards-race-name">
                        <span className="awards-race-player">{entry.position} {entry.playerName}</span>
                        <span className="dim awards-race-meta">
                          <span className="awards-race-team">{formatTeamShort(entry.teamName)}</span>
                          {entry.weeklyHonors > 0 && (
                            <span className="honor-pill" title="Weekly honors this season">
                              {entry.weeklyHonors}× POW
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="stat-val">{entry.statLine}</span>
                    </li>
                  ))}
                </ol>
              )}
            </article>
          );
        })}
      </div>
      <article className="card" aria-label="Weekly honors">
        <h2>Weekly Honors</h2>
        {recentHonors.length === 0 ? (
          <p className="dim">The first honors go out after week 1.</p>
        ) : (
          <table className="standings-table stats-table">
            <thead>
              <tr>
                <th>Wk</th>
                <th>Honor</th>
                <th>Player</th>
                <th>Team</th>
                <th>Line</th>
              </tr>
            </thead>
            <tbody>
              {recentHonors.map((honor) => {
                const info = playerLookup.get(honor.playerId);
                return (
                  <tr key={`${honor.week}-${honor.kind}`} className={honor.teamId === userTeamId ? 'user-row' : ''}>
                    <td className="rank">{honor.week}</td>
                    <td>{WEEKLY_HONOR_LABELS[honor.kind]}</td>
                    <td>{info ? `${info.position} ${info.name}` : 'Former player'}</td>
                    <td className="stats-team">{info ? formatTeamShort(info.teamName) : ''}</td>
                    <td className="stat-val">{honor.line}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </article>
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

/** Every team's per-game numbers, sortable by any column, with national ranks. */
function TeamStatsPanel({ season, userTeamId }: { season: LacrosseSeason; userTeamId: string }) {
  const [sortKey, setSortKey] = useState<TeamStatKey>('margin');
  const rows = useMemo(
    () => teamStatRankings(season.schedule, season.teams.map((t) => t.id)),
    [season.schedule, season.teams],
  );
  const names = useMemo(() => new Map(season.teams.map((t) => [t.id, t.name])), [season.teams]);
  const highlights = teamStatHighlights(rows, userTeamId);
  const sorted = sortTeamStats(rows, sortKey);

  return (
    <article className="card" aria-label="Team stats">
      <h2>Team Stats</h2>
      {rows.length === 0 ? (
        <p className="dim">No games played yet this season.</p>
      ) : (
        <>
          {highlights && (
            <p className="team-stat-highlights" aria-label="Your team stat ranks">
              Your best: <strong>#{highlights.best.rank}</strong> in {TEAM_STAT_LABELS[highlights.best.key]} · Your worst:{' '}
              <strong>#{highlights.worst.rank}</strong> in {TEAM_STAT_LABELS[highlights.worst.key]}
            </p>
          )}
          <table className="standings-table stats-table team-stats-table">
            <thead>
              <tr>
                <th></th>
                <th>Team</th>
                <th>GP</th>
                {TEAM_STAT_KEYS.map((key) => (
                  <th key={key} aria-sort={sortKey === key ? (lowerIsBetter(key) ? 'ascending' : 'descending') : 'none'}>
                    <button
                      type="button"
                      className={sortKey === key ? 'sort-header active' : 'sort-header'}
                      title={`Sort by ${TEAM_STAT_LABELS[key]}`}
                      onClick={() => setSortKey(key)}
                    >
                      {TEAM_STAT_SHORT[key]}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.teamId} className={row.teamId === userTeamId ? 'user-row' : ''}>
                  <td className="rank">#{row.ranks[sortKey]}</td>
                  <td className="stats-team">{formatTeamShort(names.get(row.teamId) ?? row.teamId)}</td>
                  <td>{row.games}</td>
                  {TEAM_STAT_KEYS.map((key) => (
                    <td key={key} className={key === sortKey ? 'stat-val sorted' : 'stat-val'}>
                      {formatTeamStat(key, row.values[key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </article>
  );
}

function TeamSplitsPanel({
  season,
  userTeamId,
  rivalries,
}: {
  season: LacrosseSeason;
  userTeamId: string;
  rivalries: Rivalry[];
}) {
  const [teamId, setTeamId] = useState(userTeamId);
  const teams = useMemo(() => [...season.teams].sort((a, b) => a.name.localeCompare(b.name)), [season.teams]);
  const splits = useMemo(
    () => teamSplits(season.schedule, teamId, rivalries),
    [season.schedule, teamId, rivalries],
  );
  const overall = splits.find((s) => s.key === 'overall')!;

  return (
    <article className="card" aria-label="Team splits">
      <div className="card-head-row">
        <h2>Team Splits</h2>
        <label className="splits-team-picker">
          <span className="dim">Team</span>
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.id === userTeamId ? ' (you)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      {splitGames(overall) === 0 ? (
        <p className="dim">No games played yet this season.</p>
      ) : (
        <table className="standings-table stats-table splits-table">
          <thead>
            <tr>
              <th>Split</th>
              <th>W-L</th>
              <th>Pct</th>
              <th>GF/G</th>
              <th>GA/G</th>
              <th>Diff</th>
            </tr>
          </thead>
          <tbody>
            {splits.map((split) => {
              const games = splitGames(split);
              const diff = split.goalsFor - split.goalsAgainst;
              return (
                <tr key={split.key} className={games === 0 ? 'dim' : ''}>
                  <td>{split.label}</td>
                  <td className="stat-val">
                    {split.wins}-{split.losses}
                  </td>
                  <td>{games === 0 ? '-' : splitWinPct(split).toFixed(3).replace(/^0/, '')}</td>
                  <td>{games === 0 ? '-' : (split.goalsFor / games).toFixed(1)}</td>
                  <td>{games === 0 ? '-' : (split.goalsAgainst / games).toFixed(1)}</td>
                  <td className={diff > 0 ? 'game-log-win' : diff < 0 ? 'game-log-loss' : ''}>
                    {games === 0 ? '-' : `${diff > 0 ? '+' : ''}${diff}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </article>
  );
}
