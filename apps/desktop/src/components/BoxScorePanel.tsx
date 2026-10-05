import { useState } from 'react';
import type { LacrossePlayerGameStats, LacrosseTeamStats } from '@sports-management-sim/sport-lacrosse';
import { formatAttendance, formatEventTime, isScoringEvent, threeStars } from '@sports-management-sim/sport-lacrosse';
import type { GameStar } from '@sports-management-sim/sport-lacrosse';
import type { GameEvent, GamePeriod } from '@sports-management-sim/sport-lacrosse';
import { formatTeamName, formatTeamShort } from '../ui/format';
import type { BoxScoreData } from '../ui/types';

type PanelTab = 'box' | 'players' | 'pbp';
type PlayFilter = 'scoring' | 'key' | 'all';

const PLAY_FILTER_LABELS: Record<PlayFilter, string> = {
  scoring: 'Scoring',
  key: 'Key plays',
  all: 'Every possession',
};

export function BoxScorePanel({
  data,
  onClose,
  playerName,
  playerPosition,
}: {
  data: BoxScoreData;
  onClose: () => void;
  /** Resolves a player id to a display name for the scoring summary. */
  playerName?: (playerId: string) => string | undefined;
  playerPosition?: (playerId: string) => string | undefined;
}) {
  const [tab, setTab] = useState<PanelTab>('box');
  const hasLog = Boolean(data.log && data.log.events.length > 0);
  const hasPlayers = Boolean(data.log?.playerLines && data.log.playerLines.length > 0 && playerName);

  const stats: Array<{ label: string; format: (s: LacrosseTeamStats, side: 'home' | 'away') => string }> = [
    { label: 'Goals', format: (s) => String(s.goals) },
    { label: 'Shots', format: (s) => String(s.shots) },
    { label: 'Shots on Goal', format: (s) => String(s.shotsOnGoal) },
    { label: 'Saves', format: (s) => String(s.saves) },
    { label: 'Ground Balls', format: (s) => String(s.groundBalls) },
    { label: 'Faceoffs', format: (s) => `${s.faceoffWins}/${s.faceoffAttempts}` },
    { label: 'Assists', format: (s) => String(s.assists) },
    { label: 'Turnovers', format: (s) => String(s.turnovers) },
    { label: 'Caused TOs', format: (s) => String(s.causedTurnovers) },
    { label: 'Clears', format: (s) => `${s.clears}/${s.clearAttempts}` },
    { label: 'Penalties', format: (s) => `${s.penalties} (${s.penaltyMinutes} min)` },
    ...(data.log?.extraMan
      ? [{ label: 'Man-Up', format: (_s: LacrosseTeamStats, side: 'home' | 'away') => `${data.log!.extraMan![side].goals}/${data.log!.extraMan![side].chances}` }]
      : []),
    ...(data.log?.possessions
      ? [{ label: 'Possessions', format: (_s: LacrosseTeamStats, side: 'home' | 'away') => String(data.log!.possessions![side]) }]
      : []),
  ];

  return (
    <div className="player-panel-backdrop" onClick={onClose}>
      <aside className="player-panel box-score-panel card" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close box score">×</button>
        <p className="panel-eyebrow">
          {data.title}
          {data.attendance && <span className="box-score-gate"> · Attendance {formatAttendance(data.attendance)}</span>}
        </p>

        <div className="box-score-header">
          <div className={`box-score-side${data.awayScore > data.homeScore ? ' winner-side' : ''}`}>
            <p className="box-score-team-name">{formatTeamName(data.awayTeamName)}</p>
            <p className="box-score-final">{data.awayScore}</p>
          </div>
          <div className="box-score-sep">
            {data.overtime ? <span className="ot-badge">OT</span> : <span>@</span>}
          </div>
          <div className={`box-score-side box-score-home${data.homeScore > data.awayScore ? ' winner-side' : ''}`}>
            <p className="box-score-team-name">{formatTeamName(data.homeTeamName)}</p>
            <p className="box-score-final">{data.homeScore}</p>
          </div>
        </div>

        {hasLog && (
          <div className="panel-tab-bar">
            <button className={`panel-tab${tab === 'box' ? ' active' : ''}`} onClick={() => setTab('box')}>
              Box Score
            </button>
            {hasPlayers && (
              <button className={`panel-tab${tab === 'players' ? ' active' : ''}`} onClick={() => setTab('players')}>
                Players
              </button>
            )}
            <button className={`panel-tab${tab === 'pbp' ? ' active' : ''}`} onClick={() => setTab('pbp')}>
              Play-by-Play
            </button>
          </div>
        )}

        {tab === 'box' && hasPlayers && data.log && (
          <ThreeStarsStrip
            stars={threeStars(
              data.log.playerLines!,
              data.homeScore > data.awayScore ? data.log.homeTeamId : data.log.awayTeamId,
            )}
            teamShort={(teamId) => formatTeamShort(teamId === data.log!.homeTeamId ? data.homeTeamName : data.awayTeamName)}
            playerName={playerName!}
            playerPosition={playerPosition}
          />
        )}

        {tab === 'box' && (
          <table className="box-score-table">
            <thead>
              <tr>
                <th className="stat-away">{formatTeamShort(data.awayTeamName)}</th>
                <th className="stat-name">Stat</th>
                <th className="stat-home">{formatTeamShort(data.homeTeamName)}</th>
              </tr>
            </thead>
            <tbody>
              {stats.map(({ label, format }) => (
                <tr key={label}>
                  <td className="stat-val">{format(data.awayStats, 'away')}</td>
                  <td className="stat-label">{label}</td>
                  <td className="stat-val">{format(data.homeStats, 'home')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'box' && data.log && playerName && (
          <ScoringSummary
            log={data.log}
            homeTeamName={data.homeTeamName}
            awayTeamName={data.awayTeamName}
            playerName={playerName}
          />
        )}

        {tab === 'players' && data.log?.playerLines && playerName && (
          <PlayerLines
            lines={data.log.playerLines}
            homeTeamId={data.log.homeTeamId}
            homeTeamName={data.homeTeamName}
            awayTeamName={data.awayTeamName}
            playerName={playerName}
            playerPosition={playerPosition}
          />
        )}

        {tab === 'pbp' && data.log && (
          <PlayByPlay
            events={data.log.events}
            homeTeamId={data.log.homeTeamId}
            homeTeamName={data.homeTeamName}
            awayTeamName={data.awayTeamName}
            leadChanges={data.log.leadChanges}
            biggestLead={data.log.biggestLead}
          />
        )}
      </aside>
    </div>
  );
}

function ScoringSummary({
  log,
  homeTeamName,
  awayTeamName,
  playerName,
}: {
  log: NonNullable<BoxScoreData['log']>;
  homeTeamName: string;
  awayTeamName: string;
  playerName: (playerId: string) => string | undefined;
}) {
  const tally = (teamId: string) => {
    const byPlayer = new Map<string, { goals: number; assists: number }>();
    const bump = (id: string, key: 'goals' | 'assists') => {
      const row = byPlayer.get(id) ?? { goals: 0, assists: 0 };
      row[key] += 1;
      byPlayer.set(id, row);
    };
    for (const e of log.events) {
      if (e.type !== 'goal' || e.teamId !== teamId) continue;
      if (e.playerId) bump(e.playerId, 'goals');
      if (e.assistPlayerId) bump(e.assistPlayerId, 'assists');
    }
    return [...byPlayer.entries()]
      .map(([id, r]) => ({ id, name: playerName(id) ?? 'Unknown', ...r }))
      .sort((a, b) => b.goals + b.assists - (a.goals + a.assists) || b.goals - a.goals);
  };
  const sides = [
    { label: formatTeamShort(awayTeamName), rows: tally(log.awayTeamId) },
    { label: formatTeamShort(homeTeamName), rows: tally(log.homeTeamId) },
  ];

  return (
    <div className="scoring-summary" aria-label="Scoring summary">
      {sides.map((side) => (
        <div key={side.label} className="scoring-side">
          <p className="pbp-period-label">{side.label} scoring</p>
          {side.rows.length === 0 && <p className="dim">No points.</p>}
          {side.rows.map((r) => (
            <div key={r.id} className="scoring-line">
              <span>{r.name}</span>
              <span className="scoring-nums">
                {r.goals > 0 ? `${r.goals}G` : ''}
                {r.goals > 0 && r.assists > 0 ? ' ' : ''}
                {r.assists > 0 ? `${r.assists}A` : ''}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const POSITION_ORDER = ['ATT', 'MID', 'LSM', 'DEF', 'FOGO', 'GK'];

function PlayerLines({
  lines,
  homeTeamId,
  homeTeamName,
  awayTeamName,
  playerName,
  playerPosition,
}: {
  lines: LacrossePlayerGameStats[];
  homeTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  playerName: (playerId: string) => string | undefined;
  playerPosition: ((playerId: string) => string | undefined) | undefined;
}) {
  const sides = [
    { label: formatTeamShort(awayTeamName), rows: lines.filter((l) => l.teamId !== homeTeamId) },
    { label: formatTeamShort(homeTeamName), rows: lines.filter((l) => l.teamId === homeTeamId) },
  ];
  const sortRows = (rows: LacrossePlayerGameStats[]) =>
    [...rows]
      .map((l) => ({ line: l, position: playerPosition?.(l.playerId) ?? '' }))
      .sort(
        (a, b) =>
          POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position) ||
          b.line.goals + b.line.assists - (a.line.goals + a.line.assists) ||
          b.line.shots - a.line.shots ||
          b.line.groundBalls - a.line.groundBalls,
      );

  return (
    <div className="player-lines" aria-label="Player box score">
      {sides.map((side) => (
        <div key={side.label} className="player-lines-side">
          <p className="pbp-period-label">{side.label}</p>
          <table className="player-lines-table">
            <thead>
              <tr>
                <th className="pl-name">Player</th>
                <th>G</th>
                <th>A</th>
                <th>Sh</th>
                <th>SOG</th>
                <th>GB</th>
                <th>TO</th>
                <th>CT</th>
                <th>FO</th>
                <th>Sv</th>
                <th>PIM</th>
              </tr>
            </thead>
            <tbody>
              {sortRows(side.rows).map(({ line, position }) => (
                <tr key={line.playerId}>
                  <td className="pl-name">
                    <span className="lineup-pos">{position}</span> {playerName(line.playerId) ?? 'Unknown'}
                  </td>
                  <td className={line.goals > 0 ? 'pl-hot' : ''}>{line.goals}</td>
                  <td className={line.assists > 0 ? 'pl-hot' : ''}>{line.assists}</td>
                  <td>{line.shots}</td>
                  <td>{line.shotsOnGoal}</td>
                  <td>{line.groundBalls}</td>
                  <td>{line.turnovers}</td>
                  <td>{line.causedTurnovers}</td>
                  <td>{line.faceoffAttempts ? `${line.faceoffWins ?? 0}/${line.faceoffAttempts}` : ''}</td>
                  <td>{line.saves !== undefined ? `${line.saves}/${line.saves + (line.goalsAllowed ?? 0)}` : ''}</td>
                  <td>{line.penaltyMinutes > 0 ? line.penaltyMinutes : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function PlayByPlay({
  events,
  homeTeamId,
  homeTeamName,
  awayTeamName,
  leadChanges,
  biggestLead,
}: {
  events: GameEvent[];
  homeTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  leadChanges: number;
  biggestLead: number;
}) {
  const hasFullLog = events.some((e) => !isScoringEvent(e));
  const [filter, setFilter] = useState<PlayFilter>(hasFullLog ? 'key' : 'scoring');
  const periods: GamePeriod[] = [...new Set(events.map((e) => e.period))] as GamePeriod[];
  const shown = events.filter((e) =>
    filter === 'all' ? e.type !== 'period_end' : filter === 'key' ? e.type === 'goal' || e.isKeyPlay || e.type === 'penalty' : e.type === 'goal',
  );

  return (
    <div className="pbp-container">
      <div className="pbp-meta">
        <span>{leadChanges} lead change{leadChanges !== 1 ? 's' : ''}</span>
        <span>Biggest lead: {biggestLead}</span>
        {hasFullLog && (
          <span className="pbp-filter" role="group" aria-label="Play-by-play filter">
            {(Object.keys(PLAY_FILTER_LABELS) as PlayFilter[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`pbp-filter-btn${filter === key ? ' active' : ''}`}
                onClick={() => setFilter(key)}
              >
                {PLAY_FILTER_LABELS[key]}
              </button>
            ))}
          </span>
        )}
      </div>

      {periods.map((period) => {
        const periodEvents = shown.filter((e) => e.period === period);
        const periodEnd = events.find((e) => e.period === period && e.type === 'period_end');
        if (periodEvents.length === 0 && !periodEnd) return null;

        const periodLabel = period === 'OT' ? 'Overtime' : `Quarter ${period}`;

        return (
          <div key={String(period)} className="pbp-period">
            <p className="pbp-period-label">
              {periodLabel}
              {periodEnd && <span className="pbp-period-score"> · {periodEnd.awayScore}–{periodEnd.homeScore}</span>}
            </p>
            {periodEvents.length === 0 && <p className="dim">No scoring.</p>}
            {periodEvents.map((event) => {
              const isHome = event.teamId === homeTeamId;
              const teamLabel = isHome ? formatTeamShort(homeTeamName) : formatTeamShort(awayTeamName);

              return (
                <div
                  key={event.id}
                  className={`pbp-event pbp-${event.type}${event.isKeyPlay ? ' pbp-key' : ''}${isHome ? ' pbp-home' : ' pbp-away'}`}
                >
                  <span className="pbp-time">{formatEventTime(event)}</span>
                  <span className="pbp-team-badge">{teamLabel}</span>
                  <span className="pbp-desc">{event.description}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

const STAR_LABELS = ['1st Star', '2nd Star', '3rd Star'];

function ThreeStarsStrip({
  stars,
  teamShort,
  playerName,
  playerPosition,
}: {
  stars: GameStar[];
  teamShort: (teamId: string) => string;
  playerName: (playerId: string) => string | undefined;
  playerPosition?: ((playerId: string) => string | undefined) | undefined;
}) {
  if (stars.length === 0) return null;
  return (
    <div className="three-stars" aria-label="Three stars">
      {stars.map((star, i) => (
        <div key={star.playerId} className="three-star">
          <span className="three-star-rank">{'★'.repeat(3 - i)} {STAR_LABELS[i]}</span>
          <strong>
            {playerPosition?.(star.playerId) ?? ''} {playerName(star.playerId) ?? 'Unknown'}
          </strong>
          <span className="dim">
            {teamShort(star.teamId)} · {star.line}
          </span>
        </div>
      ))}
    </div>
  );
}
