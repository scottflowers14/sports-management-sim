import { useState } from 'react';
import type { LacrosseTeamStats } from '@sports-management-sim/sport-lacrosse';
import { formatEventTime } from '@sports-management-sim/sport-lacrosse';
import type { GameEvent, GamePeriod } from '@sports-management-sim/sport-lacrosse';
import { formatTeamName, formatTeamShort } from '../ui/format';
import type { BoxScoreData } from '../ui/types';

type PanelTab = 'box' | 'pbp';

export function BoxScorePanel({ data, onClose }: { data: BoxScoreData; onClose: () => void }) {
  const [tab, setTab] = useState<PanelTab>('box');
  const hasLog = Boolean(data.log && data.log.events.length > 0);

  const stats: Array<{ label: string; format: (s: LacrosseTeamStats) => string }> = [
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
    { label: 'Penalties', format: (s) => `${s.penalties} (${s.penaltyMinutes}min)` },
  ];

  return (
    <div className="player-panel-backdrop" onClick={onClose}>
      <aside className="player-panel box-score-panel card" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose} aria-label="Close box score">×</button>
        <p className="panel-eyebrow">{data.title}</p>

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
            <button
              className={`panel-tab${tab === 'box' ? ' active' : ''}`}
              onClick={() => setTab('box')}
            >
              Box Score
            </button>
            <button
              className={`panel-tab${tab === 'pbp' ? ' active' : ''}`}
              onClick={() => setTab('pbp')}
            >
              Play-by-Play
            </button>
          </div>
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
                  <td className="stat-val">{format(data.awayStats)}</td>
                  <td className="stat-label">{label}</td>
                  <td className="stat-val">{format(data.homeStats)}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
  const periods: GamePeriod[] = [...new Set(events.map((e) => e.period))] as GamePeriod[];

  return (
    <div className="pbp-container">
      <div className="pbp-meta">
        <span>{leadChanges} lead change{leadChanges !== 1 ? 's' : ''}</span>
        <span>Biggest lead: {biggestLead}</span>
      </div>

      {periods.map((period) => {
        const periodEvents = events.filter((e) => e.period === period);
        const goalEvents = periodEvents.filter((e) => e.type === 'goal');
        if (goalEvents.length === 0) return null;

        const periodLabel = period === 'OT' ? 'Overtime' : `Quarter ${period}`;

        return (
          <div key={String(period)} className="pbp-period">
            <p className="pbp-period-label">{periodLabel}</p>
            {goalEvents.map((event) => {
              const isHome = event.teamId === homeTeamId;
              const teamLabel = isHome ? formatTeamShort(homeTeamName) : formatTeamShort(awayTeamName);

              return (
                <div
                  key={event.id}
                  className={`pbp-event${event.isKeyPlay ? ' pbp-key' : ''}${isHome ? ' pbp-home' : ' pbp-away'}`}
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
