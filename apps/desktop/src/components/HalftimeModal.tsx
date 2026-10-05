import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DEFENSE_LABELS,
  RIDE_LABELS,
  ROTATION_LABELS,
  TEMPO_LABELS,
  type DefensiveStyle,
  type GameLog,
  type LacrosseGamePlan,
  type MidfieldRotation,
  type OffensiveTempo,
  type RideStyle,
} from '@sports-management-sim/sport-lacrosse';
import { halftimeAdvice, halftimeReport, type HalfSideStats } from '../halftime';
import { formatTeamShort } from '../ui/format';

const STAT_ROWS: Array<{ key: keyof HalfSideStats; label: string }> = [
  { key: 'shots', label: 'Shots' },
  { key: 'faceoffWins', label: 'Faceoffs won' },
  { key: 'turnovers', label: 'Turnovers' },
  { key: 'penalties', label: 'Penalties' },
];

/**
 * The locker room at the half: the first half's score and stats, the staff's
 * read, and the plan for the second half. There is no way out but back onto
 * the field, so the first half can't be rerolled.
 */
export function HalftimeModal({
  log,
  label,
  userTeamId,
  teamMap,
  gamePlan,
  onPlaySecondHalf,
}: {
  log: GameLog;
  /** What the game is: "Week 3", "NCAA Quarterfinal". */
  label: string;
  userTeamId: string;
  teamMap: Map<string, string>;
  gamePlan: LacrosseGamePlan;
  onPlaySecondHalf: (plan: LacrosseGamePlan) => void;
}) {
  const [plan, setPlan] = useState<LacrosseGamePlan>(gamePlan);
  const report = halftimeReport(log);
  const tips = halftimeAdvice(report, userTeamId, gamePlan);
  const name = (id: string) => formatTeamShort(teamMap.get(id) ?? id);
  const changed = (Object.keys(plan) as (keyof LacrosseGamePlan)[]).filter((k) => plan[k] !== gamePlan[k]).length;

  const select = <K extends keyof LacrosseGamePlan>(
    key: K,
    label: string,
    labels: Record<LacrosseGamePlan[K], { label: string; hint: string }>,
  ) => (
    <label className="gameplan-row">
      <span className="gameplan-label">{label}</span>
      <select aria-label={`Second half ${label}`} value={plan[key]} onChange={(e) => setPlan({ ...plan, [key]: e.target.value })}>
        {(Object.keys(labels) as LacrosseGamePlan[K][]).map((value) => (
          <option key={value} value={value}>
            {labels[value].label}
          </option>
        ))}
      </select>
    </label>
  );

  return createPortal(
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="halftime-title">
      <div className="modal-panel card halftime-panel">
        <p className="eyebrow">{label} · Halftime</p>
        <h2 id="halftime-title" className="halftime-score">
          <span>{name(log.awayTeamId)}</span> <strong>{report.awayScore}</strong>
          <span className="dim"> at </span>
          <span>{name(log.homeTeamId)}</span> <strong>{report.homeScore}</strong>
        </h2>
        <table className="standings-table halftime-stats">
          <thead>
            <tr>
              <th></th>
              <th>{name(log.awayTeamId)}</th>
              <th>{name(log.homeTeamId)}</th>
            </tr>
          </thead>
          <tbody>
            {STAT_ROWS.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td>{report.away[row.key]}</td>
                <td>{report.home[row.key]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {report.goals.length > 0 && (
          <details className="halftime-goals">
            <summary>First-half goals ({report.goals.length})</summary>
            <ul>
              {report.goals.map((g) => (
                <li key={g.id}>
                  Q{g.period} {Math.floor(g.timeElapsed / 60)}:{String(g.timeElapsed % 60).padStart(2, '0')} · {g.description}
                </li>
              ))}
            </ul>
          </details>
        )}
        <div className="halftime-tips" aria-label="Staff advice">
          <p className="section-label">Staff read</p>
          {tips.map((tip) => (
            <div key={tip.text} className="halftime-tip">
              <span>{tip.text}</span>
              {Object.keys(tip.plan).length > 0 && (
                <button type="button" className="ghost-btn" onClick={() => setPlan({ ...plan, ...tip.plan })}>
                  Use this
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="halftime-plan" aria-label="Second half plan">
          <p className="section-label">Second half plan</p>
          {select('tempo', 'Offensive Tempo', TEMPO_LABELS as Record<OffensiveTempo, { label: string; hint: string }>)}
          {select('defense', 'Defensive Style', DEFENSE_LABELS as Record<DefensiveStyle, { label: string; hint: string }>)}
          {select('ride', 'Ride', RIDE_LABELS as Record<RideStyle, { label: string; hint: string }>)}
          {select('rotation', 'Midfield Rotation', ROTATION_LABELS as Record<MidfieldRotation, { label: string; hint: string }>)}
        </div>
        <div className="modal-actions">
          <button type="button" className="primary-action" onClick={() => onPlaySecondHalf(plan)}>
            Play Second Half{changed > 0 ? ` (${changed} adjustment${changed === 1 ? '' : 's'})` : ''}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
