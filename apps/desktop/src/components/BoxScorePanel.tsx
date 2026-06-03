import type { LacrosseTeamStats } from '@sports-management-sim/sport-lacrosse';
import { formatTeamName, formatTeamShort } from '../ui/format';
import type { BoxScoreData } from '../ui/types';

export function BoxScorePanel({ data, onClose }: { data: BoxScoreData; onClose: () => void }) {
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
      </aside>
    </div>
  );
}
