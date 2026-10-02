import {
  DEVELOPMENT_FOCUS_AREAS,
  focusAreasFor,
  MAX_DEVELOPMENT_PLANS,
  PRACTICE_INTENSITIES,
  PROGRESS_PER_POINT,
  type DevelopableRating,
  type DevelopmentFocusArea,
  type LacrossePlayer,
  type LacrossePracticePlan,
  type LacrosseTeam,
  type PracticeIntensity,
} from '@sports-management-sim/sport-lacrosse';
import { TRAINING_FOCUS_LABELS, type TrainingFocus } from '../dynasty-helpers';
import type { PracticeLogEntry } from '../week-sim';

const RATING_LABELS: Record<DevelopableRating, string> = {
  shooting: 'shooting',
  passing: 'passing',
  dodging: 'dodging',
  stickSkills: 'stick skills',
  offBallMovement: 'off-ball',
  defense: 'defense',
  checking: 'checking',
  groundBalls: 'ground balls',
  faceoffs: 'faceoffs',
  goalieReflexes: 'reflexes',
  goaliePositioning: 'positioning',
  goalieClearing: 'clearing',
  athleticism: 'athleticism',
  speed: 'speed',
  strength: 'strength',
  stamina: 'stamina',
};

const INTENSITY_ORDER: PracticeIntensity[] = ['light', 'normal', 'intense'];

interface PracticeScreenProps {
  team: LacrosseTeam;
  plan: LacrossePracticePlan;
  gains: PracticeLogEntry[];
  injuredIds: ReadonlySet<string>;
  trainingFocus: TrainingFocus;
  onIntensityChange: (intensity: PracticeIntensity) => void;
  onSetPlan: (playerId: string, focus: DevelopmentFocusArea) => void;
  onRemovePlan: (playerId: string) => void;
  onAutoFill: () => void;
  onTrainingFocusChange: (focus: TrainingFocus) => void;
  onSelectPlayer: (playerId: string) => void;
}

function playerName(player: LacrossePlayer): string {
  return `${player.name.first} ${player.name.last}`;
}

function ProgressBar({ player }: { player: LacrossePlayer }) {
  const atCeiling = player.ratings.overall >= player.ratings.potential;
  const pct = atCeiling ? 100 : Math.round(((player.developmentProgress ?? 0) / PROGRESS_PER_POINT) * 100);
  return (
    <div className="practice-progress" title={atCeiling ? 'At his ceiling' : `${pct}% of the way to his next point`}>
      <div className={`practice-progress-fill${atCeiling ? ' at-ceiling' : ''}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function PracticeScreen({
  team,
  plan,
  gains,
  injuredIds,
  trainingFocus,
  onIntensityChange,
  onSetPlan,
  onRemovePlan,
  onAutoFill,
  onTrainingFocusChange,
  onSelectPlayer,
}: PracticeScreenProps) {
  const intensity = PRACTICE_INTENSITIES[plan.intensity];
  const byId = new Map(team.roster.map((p) => [p.id, p]));
  const planned = plan.developmentPlans.flatMap((entry) => {
    const player = byId.get(entry.playerId);
    return player ? [{ player, focus: entry.focus }] : [];
  });
  const plannedIds = new Set(planned.map((p) => p.player.id));
  const full = planned.length >= MAX_DEVELOPMENT_PLANS;
  const seasonGain = new Map<string, number>();
  for (const gain of gains) seasonGain.set(gain.playerId, (seasonGain.get(gain.playerId) ?? 0) + 1);
  const totalGain = gains.length;
  const roster = [...team.roster].sort(
    (a, b) =>
      b.ratings.potential - b.ratings.overall - (a.ratings.potential - a.ratings.overall) ||
      b.ratings.potential - a.ratings.potential ||
      a.id.localeCompare(b.id),
  );

  return (
    <div className="practice-layout">
      <article className="card" aria-label="Practice plan">
        <div className="practice-header">
          <div>
            <p className="eyebrow">Weekly practice</p>
            <h2>Practice Plan</h2>
          </div>
          <div className="practice-season-total">
            <strong>+{totalGain}</strong>
            <span className="dim">rating points at practice this season</span>
          </div>
        </div>
        <div className="practice-intensity" role="radiogroup" aria-label="Practice intensity">
          {INTENSITY_ORDER.map((key) => {
            const option = PRACTICE_INTENSITIES[key];
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={plan.intensity === key}
                className={`practice-intensity-option${plan.intensity === key ? ' active' : ''}`}
                onClick={() => onIntensityChange(key)}
              >
                <strong>{option.label}</strong>
                <span className="dim">{option.description}</span>
                <span className="practice-intensity-stats">
                  Growth ×{option.progress.toFixed(2)} · Injury risk ×{option.injuryRisk.toFixed(1)}
                </span>
              </button>
            );
          })}
        </div>
        <p className="dim practice-note">
          Everyone banks progress at practice each week, plus extra for game minutes. Every {PROGRESS_PER_POINT} points
          is a rating point. Players near their ceiling grow slowly, and injured players sit out. {intensity.label} is
          the current setting.
        </p>
        <label className="practice-offseason-focus">
          <span>Offseason training focus</span>
          <select value={trainingFocus} onChange={(e) => onTrainingFocusChange(e.target.value as TrainingFocus)}>
            {(Object.keys(TRAINING_FOCUS_LABELS) as TrainingFocus[]).map((focus) => (
              <option key={focus} value={focus}>
                {TRAINING_FOCUS_LABELS[focus].label}
              </option>
            ))}
          </select>
          <span className="dim">{TRAINING_FOCUS_LABELS[trainingFocus].hint}</span>
        </label>
      </article>

      <article className="card" aria-label="Development plans">
        <div className="practice-header">
          <div>
            <p className="eyebrow">
              {planned.length} of {MAX_DEVELOPMENT_PLANS} slots
            </p>
            <h2>Development Plans</h2>
          </div>
          <button type="button" className="offer-btn practice-fill-btn" disabled={full} onClick={onAutoFill}>
            Fill open slots
          </button>
        </div>
        <p className="dim practice-note">
          Players on a plan grow twice as fast at practice, and each point goes to the skills you pick.
        </p>
        {planned.length === 0 && <p className="dim">No plans yet. Add players from the roster below.</p>}
        <ul className="practice-plan-list">
          {planned.map(({ player, focus }) => (
            <li key={player.id} className="practice-plan">
              <div className="practice-plan-player">
                <button type="button" className="practice-name-btn" onClick={() => onSelectPlayer(player.id)}>
                  {playerName(player)}
                </button>
                <span className="dim">
                  {player.position} · {player.classYear} · {player.ratings.overall} / {player.ratings.potential} POT
                  {injuredIds.has(player.id) ? ' · injured' : ''}
                </span>
                <ProgressBar player={player} />
              </div>
              <label className="practice-plan-focus">
                <span className="dim">Focus</span>
                <select
                  aria-label={`Development focus for ${playerName(player)}`}
                  value={focus}
                  onChange={(e) => onSetPlan(player.id, e.target.value as DevelopmentFocusArea)}
                >
                  {focusAreasFor(player.position).map((area) => (
                    <option key={area} value={area}>
                      {DEVELOPMENT_FOCUS_AREAS[area].label}
                    </option>
                  ))}
                </select>
                <span className="dim practice-plan-focus-hint">{DEVELOPMENT_FOCUS_AREAS[focus].description}</span>
              </label>
              <span className="practice-gain">{seasonGain.get(player.id) ? `+${seasonGain.get(player.id)}` : ''}</span>
              <button type="button" className="staff-release-btn" onClick={() => onRemovePlan(player.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      </article>

      <article className="card" aria-label="Roster development">
        <h2>Roster Development</h2>
        <p className="dim practice-note">Sorted by room to grow. The bar shows progress toward the next rating point.</p>
        <table className="standings-table practice-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Pos</th>
              <th>Cls</th>
              <th>OVR</th>
              <th>POT</th>
              <th>Progress</th>
              <th>Season</th>
              <th aria-label="Plan" />
            </tr>
          </thead>
          <tbody>
            {roster.map((player) => {
              const onPlan = plannedIds.has(player.id);
              const capped = player.ratings.overall >= player.ratings.potential;
              const gained = seasonGain.get(player.id) ?? 0;
              return (
                <tr key={player.id} className={onPlan ? 'practice-row-planned' : undefined}>
                  <td>
                    <button type="button" className="practice-name-btn" onClick={() => onSelectPlayer(player.id)}>
                      {playerName(player)}
                    </button>
                    {injuredIds.has(player.id) && <span className="practice-injured"> INJ</span>}
                  </td>
                  <td>{player.position}</td>
                  <td>{player.classYear}</td>
                  <td>{player.ratings.overall}</td>
                  <td>{player.ratings.potential}</td>
                  <td>
                    <ProgressBar player={player} />
                  </td>
                  <td className={gained > 0 ? 'practice-gain' : 'dim'}>{gained > 0 ? `+${gained}` : '—'}</td>
                  <td>
                    {onPlan ? (
                      <span className="dim">On plan</span>
                    ) : (
                      <button
                        type="button"
                        className="offer-btn practice-add-btn"
                        disabled={full || capped}
                        title={capped ? 'At his ceiling' : full ? 'All plan slots are taken' : undefined}
                        onClick={() => onSetPlan(player.id, 'balanced')}
                      >
                        Add plan
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </article>

      <article className="card" aria-label="Practice log">
        <h2>Practice Log</h2>
        {gains.length === 0 && <p className="dim">No one has gained a point at practice yet this season.</p>}
        <ul className="practice-log">
          {gains.slice(0, 12).map((gain, i) => {
            const player = byId.get(gain.playerId);
            return (
              <li key={`${gain.playerId}-${gain.week}-${gain.to}-${i}`}>
                <span className="dim">Wk {gain.week}</span>{' '}
                <strong>{player ? `${player.position} ${playerName(player)}` : 'Former player'}</strong> {gain.from} →{' '}
                <span className="practice-gain">{gain.to}</span>{' '}
                <span className="dim">({gain.improved.map((key) => RATING_LABELS[key]).join(', ')})</span>
              </li>
            );
          })}
        </ul>
      </article>
    </div>
  );
}
