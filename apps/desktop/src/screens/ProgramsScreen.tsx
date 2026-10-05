import { useMemo, useState } from 'react';
import { calculateLacrosseTeamRating, coachName } from '@sports-management-sim/sport-lacrosse';
import type { LacrossePosition, LacrosseTeam, ProDraftPick } from '@sports-management-sim/sport-lacrosse';
import type { Conference, ScheduledGame } from '@sports-management-sim/engine-core';
import type { RankingEntry } from '../rankings';
import type { SeasonStatsMap } from '../stats';
import {
  buildProgramRows,
  computeGoalTotals,
  sortRows,
  type ProgramRow,
  type ProgramSortKey,
} from '../league-browser';
import { RatingCell } from '../components/RatingCell';
import { SortHeader, nextSort, type SortState } from '../components/SortHeader';
import { formatStreak, type SeriesRecord } from '../series-history';
import { formatTeamName } from '../ui/format';

const POSITION_ORDER: LacrossePosition[] = ['ATT', 'MID', 'DEF', 'LSM', 'GK', 'FOGO'];

// Rank reads best-first ascending; every other number reads best-first descending.
const ASCENDING_FIRST: ReadonlySet<ProgramSortKey> = new Set(['name', 'conferenceName', 'rank', 'losses', 'goalsAgainst']);

export function ProgramsScreen({
  teams,
  conferences,
  rankings,
  schedule,
  seasonStats,
  userTeamId,
  programId,
  onOpenProgram,
  onSelectPlayer,
  proDraftHistory = [],
  seriesFor,
}: {
  teams: LacrosseTeam[];
  conferences: Conference[];
  rankings: RankingEntry[];
  schedule: ScheduledGame[];
  seasonStats: SeasonStatsMap;
  userTeamId: string;
  programId: string | null;
  onOpenProgram: (teamId: string | null) => void;
  onSelectPlayer: (playerId: string) => void;
  /** Every pro draft so far, newest first. */
  proDraftHistory?: ProDraftPick[];
  /** Your head-to-head series with a program. */
  seriesFor?: (teamId: string) => SeriesRecord | undefined;
}) {
  const [confFilter, setConfFilter] = useState<string>('ALL');
  const [sort, setSort] = useState<SortState<ProgramSortKey>>({ key: 'overall', direction: 'desc' });

  const goalTotals = useMemo(() => computeGoalTotals(schedule), [schedule]);
  const rows = useMemo(
    () => buildProgramRows({ teams, conferences, rankings, goalTotals, userTeamId }),
    [teams, conferences, rankings, goalTotals, userTeamId],
  );

  const program = programId ? teams.find((t) => t.id === programId) : undefined;
  if (program) {
    const row = rows.find((r) => r.teamId === program.id);
    return (
      <ProgramDetail
        team={program}
        row={row}
        teams={teams}
        schedule={schedule}
        seasonStats={seasonStats}
        onBack={() => onOpenProgram(null)}
        onOpenProgram={onOpenProgram}
        onSelectPlayer={onSelectPlayer}
        draftees={proDraftHistory.filter((p) => p.collegeTeamId === program.id)}
        series={program.id === userTeamId ? null : (seriesFor?.(program.id) ?? undefined)}
      />
    );
  }

  const visible = sortRows(
    rows.filter((r) => confFilter === 'ALL' || r.conferenceId === confFilter),
    sort.key,
    sort.direction,
  );
  const onSort = (key: ProgramSortKey) =>
    setSort((s) => nextSort(s, key, ASCENDING_FIRST.has(key) ? 'asc' : 'desc'));
  const h = (label: string, key: ProgramSortKey, title?: string) => (
    <SortHeader label={label} column={key} sort={sort} onSort={onSort} {...(title ? { title } : {})} />
  );

  return (
    <article className="card dense-card">
      <div className="screen-toolbar">
        <div>
          <p className="eyebrow">League</p>
          <h2>Programs</h2>
        </div>
        <label className="toolbar-field">
          Conference
          <select value={confFilter} onChange={(e) => setConfFilter(e.target.value)} aria-label="Filter programs by conference">
            <option value="ALL">All conferences</option>
            {conferences.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <span className="dim">{visible.length} programs · click a row to open its page</span>
      </div>
      <div className="table-scroll">
        <table className="data-grid">
          <thead>
            <tr>
              {h('#', 'rank', 'National rank')}
              {h('Program', 'name')}
              {h('Conf', 'conferenceName')}
              {h('PRS', 'prestige', 'National prestige')}
              {h('W', 'wins')}
              {h('L', 'losses')}
              {h('CW', 'conferenceWins', 'Conference wins')}
              {h('CL', 'conferenceLosses', 'Conference losses')}
              {h('GF', 'goalsFor', 'Goals for')}
              {h('GA', 'goalsAgainst', 'Goals against')}
              {h('OVR', 'overall', 'Team overall rating')}
              {h('OFF', 'offense')}
              {h('DEF', 'defense')}
              {h('GK', 'goalie')}
              {h('FO', 'faceoff')}
              {h('ROS', 'rosterSize', 'Roster size')}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <ProgramTableRow key={r.teamId} row={r} onOpen={() => onOpenProgram(r.teamId)} />
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function ProgramTableRow({ row: r, onOpen }: { row: ProgramRow; onOpen: () => void }) {
  return (
    <tr className={r.isUser ? 'user-row clickable-row' : 'clickable-row'} onClick={onOpen}>
      <td className="num">{r.rank ?? '—'}</td>
      <td>
        <button type="button" className="link-btn" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
          {r.name}
        </button>
      </td>
      <td>{r.conferenceName}</td>
      <td className="num"><RatingCell value={r.prestige} /></td>
      <td className="num">{r.wins}</td>
      <td className="num">{r.losses}</td>
      <td className="num">{r.conferenceWins}</td>
      <td className="num">{r.conferenceLosses}</td>
      <td className="num">{r.goalsFor}</td>
      <td className="num">{r.goalsAgainst}</td>
      <td className="num"><RatingCell value={r.overall} /></td>
      <td className="num"><RatingCell value={r.offense} /></td>
      <td className="num"><RatingCell value={r.defense} /></td>
      <td className="num"><RatingCell value={r.goalie} /></td>
      <td className="num"><RatingCell value={r.faceoff} /></td>
      <td className="num">{r.rosterSize}</td>
    </tr>
  );
}

function ProgramDetail({
  team,
  row,
  teams,
  schedule,
  seasonStats,
  onBack,
  onOpenProgram,
  onSelectPlayer,
  draftees,
  series,
}: {
  team: LacrosseTeam;
  row: ProgramRow | undefined;
  teams: LacrosseTeam[];
  schedule: ScheduledGame[];
  seasonStats: SeasonStatsMap;
  onBack: () => void;
  onOpenProgram: (teamId: string) => void;
  onSelectPlayer: (playerId: string) => void;
  /** This program's pro draft picks, newest first. */
  draftees: ProDraftPick[];
  /** Your series with them; null on your own program page. */
  series: SeriesRecord | null | undefined;
}) {
  const rating = calculateLacrosseTeamRating(team);
  const nameById = new Map(teams.map((t) => [t.id, formatTeamName(t.name)]));
  const games = schedule
    .filter((g) => g.homeTeamId === team.id || g.awayTeamId === team.id)
    .sort((a, b) => a.week - b.week);
  const roster = [...team.roster].sort(
    (a, b) =>
      POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position) || b.ratings.overall - a.ratings.overall,
  );
  const rep = team.reputation;

  return (
    <div className="program-detail">
      <article className="card dense-card">
        <div className="screen-toolbar">
          <button type="button" className="ghost-btn" onClick={onBack}>← All Programs</button>
          <div>
            <p className="eyebrow">{row?.conferenceName ?? team.conferenceId.toUpperCase()} · Program Page</p>
            <h2>{formatTeamName(team.name)}</h2>
            {team.headCoach && (
              <p className="program-coach" aria-label="Head coach">
                Head Coach {coachName(team.headCoach)} · since {team.headCoach.hiredYear} · {team.headCoach.rating} rating ·{' '}
                {team.headCoach.wins}–{team.headCoach.losses} here, {team.headCoach.careerWins}–{team.headCoach.careerLosses} career
                {team.headCoach.hotSeat > 0 && <span className="hot-seat-pill">Hot seat</span>}
              </p>
            )}
          </div>
        </div>
        <div className="kv-strip">
          <KV label="Record" value={`${team.record.wins}–${team.record.losses}`} />
          <KV label="Conf" value={`${team.record.conferenceWins}–${team.record.conferenceLosses}`} />
          <KV label="Rank" value={row?.rank ? `#${row.rank}` : '—'} />
          <KV label="Team OVR" value={rating.overall} />
          <KV label="OFF" value={rating.offense} />
          <KV label="DEF" value={rating.defense} />
          <KV label="GK" value={rating.goalie} />
          <KV label="FO" value={rating.faceoff} />
          <KV label="Depth" value={rating.depth} />
          <KV label="Prestige" value={rep.nationalPrestige} />
          <KV label="Academics" value={rep.academicPrestige} />
          <KV label="Facilities" value={rep.facilities} />
          <KV label="Fans" value={rep.fanSupport} />
          <KV label="Pro picks" value={draftees.length} />
          {series !== null && (
            <KV label="Your Series" value={series ? `${series.wins}–${series.losses}${series.streak ? ` (${formatStreak(series)})` : ''}` : 'Never met'} />
          )}
          <KV label="Scholarships" value={`${team.resources.scholarshipUsed.toFixed(1)} / ${team.resources.scholarshipLimit}`} />
        </div>
      </article>

      <div className="program-detail-grid">
        <article className="card dense-card">
          <h3 className="grid-title">Roster ({team.roster.length})</h3>
          <div className="table-scroll">
            <table className="data-grid">
              <thead>
                <tr>
                  <th>POS</th><th>Player</th><th>CL</th><th>OVR</th><th>POT</th>
                  <th>ATH</th><th>SPD</th><th>SKL</th><th>IQ</th><th>GP</th><th>PTS</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((p) => {
                  const s = seasonStats[p.id];
                  return (
                    <tr key={p.id} className="clickable-row" onClick={() => onSelectPlayer(p.id)}>
                      <td><span className="roster-pos-tag">{p.position}</span></td>
                      <td>{p.name.first} {p.name.last}</td>
                      <td>{p.classYear}</td>
                      <td className="num"><RatingCell value={p.ratings.overall} /></td>
                      <td className="num"><RatingCell value={p.ratings.potential} /></td>
                      <td className="num">{p.ratings.athleticism}</td>
                      <td className="num">{p.ratings.speed}</td>
                      <td className="num">{p.ratings.skill}</td>
                      <td className="num">{p.ratings.iq}</td>
                      <td className="num">{s?.gamesPlayed ?? 0}</td>
                      <td className="num">{(s?.goals ?? 0) + (s?.assists ?? 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card dense-card">
          <h3 className="grid-title">Schedule &amp; Results</h3>
          <table className="data-grid">
            <thead>
              <tr><th>WK</th><th>Opponent</th><th>Result</th></tr>
            </thead>
            <tbody>
              {games.map((g) => {
                const isHome = g.homeTeamId === team.id;
                const oppId = isHome ? g.awayTeamId : g.homeTeamId;
                const r = g.result;
                let resultCell = <span className="dim">—</span>;
                if (g.status === 'final' && r) {
                  const us = isHome ? r.homeScore : r.awayScore;
                  const them = isHome ? r.awayScore : r.homeScore;
                  const won = r.winnerTeamId === team.id;
                  resultCell = (
                    <span className={won ? 'res-w' : 'res-l'}>
                      {won ? 'W' : 'L'} {us}–{them}{r.overtime ? ' OT' : ''}
                    </span>
                  );
                }
                return (
                  <tr key={g.id}>
                    <td className="num">{g.week}</td>
                    <td>
                      {isHome ? 'vs ' : '@ '}
                      <button type="button" className="link-btn" onClick={() => onOpenProgram(oppId)}>
                        {nameById.get(oppId) ?? oppId}
                      </button>
                      {g.conferenceGame && <span className="conf-tag">C</span>}
                    </td>
                    <td>{resultCell}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </article>

        {draftees.length > 0 && (
          <article className="card dense-card" aria-label="Pro draft picks">
            <h3 className="grid-title">In the Pros ({draftees.length})</h3>
            <table className="data-grid">
              <thead>
                <tr><th>Year</th><th>Pick</th><th>Player</th><th>OVR</th><th>Pro team</th></tr>
              </thead>
              <tbody>
                {draftees.map((p) => (
                  <tr key={`${p.year}-${p.playerId}`}>
                    <td className="num">{p.year}</td>
                    <td className="num">{p.round}.{String(p.pick).padStart(2, '0')}</td>
                    <td><span className="roster-pos-tag">{p.position}</span> {p.name}</td>
                    <td className="num"><RatingCell value={p.overall} /></td>
                    <td>{p.proTeam}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        )}
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="kv">
      <span className="kv-label">{label}</span>
      <span className="kv-value">{value}</span>
    </div>
  );
}
