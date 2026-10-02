import { useMemo, useState } from 'react';
import type { LacrossePosition, LacrosseTeam } from '@sports-management-sim/sport-lacrosse';
import type { Conference, PlayerClass } from '@sports-management-sim/engine-core';
import type { SeasonStatsMap } from '../stats';
import {
  buildPlayerRows,
  filterPlayerRows,
  sortRows,
  type PlayerSortKey,
} from '../league-browser';
import { RatingCell } from '../components/RatingCell';
import { SortHeader, nextSort, type SortState } from '../components/SortHeader';
import { formatTeamName } from '../ui/format';

const PAGE_SIZE = 50;
const POSITIONS: Array<LacrossePosition | 'ALL'> = ['ALL', 'ATT', 'MID', 'DEF', 'LSM', 'GK', 'FOGO'];
const CLASSES: Array<PlayerClass | 'ALL'> = ['ALL', 'FR', 'SO', 'JR', 'SR', 'GR'];
const ASCENDING_FIRST: ReadonlySet<PlayerSortKey> = new Set(['name', 'teamName', 'position', 'classYear']);

export function PlayersScreen({
  teams,
  conferences,
  seasonStats,
  userTeamId,
  onSelectPlayer,
  onOpenProgram,
}: {
  teams: LacrosseTeam[];
  conferences: Conference[];
  seasonStats: SeasonStatsMap;
  userTeamId: string;
  onSelectPlayer: (playerId: string) => void;
  onOpenProgram: (teamId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState<LacrossePosition | 'ALL'>('ALL');
  const [classYear, setClassYear] = useState<PlayerClass | 'ALL'>('ALL');
  const [conferenceId, setConferenceId] = useState('ALL');
  const [teamId, setTeamId] = useState('ALL');
  const [sort, setSort] = useState<SortState<PlayerSortKey>>({ key: 'overall', direction: 'desc' });
  const [page, setPage] = useState(0);

  const allRows = useMemo(() => buildPlayerRows(teams, seasonStats, userTeamId), [teams, seasonStats, userTeamId]);
  const filtered = useMemo(
    () => sortRows(filterPlayerRows(allRows, { search, position, classYear, conferenceId, teamId }), sort.key, sort.direction),
    [allRows, search, position, classYear, conferenceId, teamId, sort],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const teamOptions = [...teams]
    .filter((t) => conferenceId === 'ALL' || t.conferenceId === conferenceId)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Any filter change returns to page one so results never land on an empty page.
  const withReset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(0); };
  const onSort = (key: PlayerSortKey) => {
    setSort((s) => nextSort(s, key, ASCENDING_FIRST.has(key) ? 'asc' : 'desc'));
    setPage(0);
  };
  const h = (label: string, key: PlayerSortKey, title?: string) => (
    <SortHeader label={label} column={key} sort={sort} onSort={onSort} {...(title ? { title } : {})} />
  );

  return (
    <article className="card dense-card">
      <div className="screen-toolbar">
        <div>
          <p className="eyebrow">League</p>
          <h2>Player Search</h2>
        </div>
        <label className="toolbar-field">
          Name or school
          <input
            type="search"
            value={search}
            onChange={(e) => withReset(setSearch)(e.target.value)}
            placeholder="Search…"
            aria-label="Search players"
          />
        </label>
        <label className="toolbar-field">
          Position
          <select value={position} onChange={(e) => withReset(setPosition)(e.target.value as LacrossePosition | 'ALL')} aria-label="Filter by position">
            {POSITIONS.map((p) => <option key={p} value={p}>{p === 'ALL' ? 'All' : p}</option>)}
          </select>
        </label>
        <label className="toolbar-field">
          Class
          <select value={classYear} onChange={(e) => withReset(setClassYear)(e.target.value as PlayerClass | 'ALL')} aria-label="Filter by class">
            {CLASSES.map((c) => <option key={c} value={c}>{c === 'ALL' ? 'All' : c}</option>)}
          </select>
        </label>
        <label className="toolbar-field">
          Conference
          <select
            value={conferenceId}
            onChange={(e) => { withReset(setConferenceId)(e.target.value); setTeamId('ALL'); }}
            aria-label="Filter players by conference"
          >
            <option value="ALL">All</option>
            {conferences.map((c) => <option key={c.id} value={c.id}>{c.shortName || c.name}</option>)}
          </select>
        </label>
        <label className="toolbar-field">
          Program
          <select value={teamId} onChange={(e) => withReset(setTeamId)(e.target.value)} aria-label="Filter by program">
            <option value="ALL">All</option>
            {teamOptions.map((t) => <option key={t.id} value={t.id}>{formatTeamName(t.name)}</option>)}
          </select>
        </label>
      </div>

      <div className="table-scroll">
        <table className="data-grid">
          <thead>
            <tr>
              {h('Player', 'name')}
              {h('Program', 'teamName')}
              {h('POS', 'position')}
              {h('CL', 'classYear', 'Class year')}
              {h('OVR', 'overall', 'Overall')}
              {h('POT', 'potential', 'Potential')}
              {h('ATH', 'athleticism', 'Athleticism')}
              {h('SPD', 'speed', 'Speed')}
              {h('SKL', 'skill', 'Skill')}
              {h('IQ', 'iq', 'Lacrosse IQ')}
              {h('GP', 'gamesPlayed', 'Games played')}
              {h('G', 'goals', 'Goals')}
              {h('A', 'assists', 'Assists')}
              {h('PTS', 'points', 'Points')}
              {h('GB', 'groundBalls', 'Ground balls')}
              {h('CT', 'causedTurnovers', 'Caused turnovers')}
              {h('SV', 'saves', 'Saves')}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr key={r.playerId} className={r.isUser ? 'user-row clickable-row' : 'clickable-row'} onClick={() => onSelectPlayer(r.playerId)}>
                <td>{r.name}</td>
                <td>
                  <button type="button" className="link-btn" onClick={(e) => { e.stopPropagation(); onOpenProgram(r.teamId); }}>
                    {r.teamName}
                  </button>
                </td>
                <td><span className="roster-pos-tag">{r.position}</span></td>
                <td>{r.classYear}</td>
                <td className="num"><RatingCell value={r.overall} /></td>
                <td className="num"><RatingCell value={r.potential} /></td>
                <td className="num">{r.athleticism}</td>
                <td className="num">{r.speed}</td>
                <td className="num">{r.skill}</td>
                <td className="num">{r.iq}</td>
                <td className="num">{r.gamesPlayed}</td>
                <td className="num">{r.goals}</td>
                <td className="num">{r.assists}</td>
                <td className="num">{r.points}</td>
                <td className="num">{r.groundBalls}</td>
                <td className="num">{r.causedTurnovers}</td>
                <td className="num">{r.saves}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {pageRows.length === 0 && <p className="dim empty-note">No players match these filters.</p>}
      </div>

      <div className="pager">
        <span className="dim">
          {filtered.length === 0
            ? '0 players'
            : `${safePage * PAGE_SIZE + 1}–${safePage * PAGE_SIZE + pageRows.length} of ${filtered.length} players`}
        </span>
        <button type="button" className="ghost-btn" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>‹ Prev</button>
        <span className="dim">Page {safePage + 1} / {pageCount}</span>
        <button type="button" className="ghost-btn" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>Next ›</button>
      </div>
    </article>
  );
}
