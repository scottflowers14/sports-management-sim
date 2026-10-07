import {
  DEFENSE_LABELS,
  RIDE_LABELS,
  ROTATION_LABELS,
  TEMPO_LABELS,
  describeGamePlan,
  scoutedGamePlan,
  TEAM_STAT_LABELS,
  type ScoutKey,
  type TapeLine,
  type TeamTendencies,
  type DefensiveStyle,
  type LacrosseGamePlan,
  type MidfieldRotation,
  type OffensiveTempo,
  type RideStyle,
} from '@sports-management-sim/sport-lacrosse';
import { TEAM_STAT_SHORT, formatTeamStat } from '../ui/team-stat-format';

export interface OpponentScout {
  week: number;
  /** Shown instead of the week in the postseason, e.g. "Conference Final". */
  label?: string;
  name: string;
  isHome: boolean;
  plan: LacrosseGamePlan;
  rating: number;
  /** Their per-game averages this season; null before their first box score. */
  tendencies: TeamTendencies | null;
  /** The scout's keys to the game, strongest first. */
  keys: ScoutKey[];
  /** Both teams' national ranks side by side; null until both have played. */
  tape?: TapeLine[] | null;
}

/**
 * The scouting report and the four game-plan calls. Lives on the Season
 * screen and in the pregame step of Coach the Game, so the plan is set where
 * the game is played.
 */
export function GamePlanPanel({
  scout,
  gamePlan,
  onGamePlanChange,
  autoGamePlan,
  onUseStaffPlan,
}: {
  scout: OpponentScout | null | undefined;
  gamePlan: LacrosseGamePlan;
  onGamePlanChange: (plan: LacrosseGamePlan) => void;
  autoGamePlan?: boolean | undefined;
  onUseStaffPlan?: (() => void) | undefined;
}) {
  const nextOpponentScout = scout;
  return (
    <>
      {nextOpponentScout && (
        <div className="scout-report" aria-label="Opponent scouting report">
          <span className="section-label">Scouting Report</span>
          <p className="scout-opponent">
            {nextOpponentScout.label ?? `Wk ${nextOpponentScout.week}`} {nextOpponentScout.isHome ? 'vs' : 'at'}{' '}
            {nextOpponentScout.name}
            <span className="scout-ovr"> · {nextOpponentScout.rating} OVR</span>
          </p>
          <p className="scout-tendencies">Tendencies: {describeGamePlan(nextOpponentScout.plan)}</p>
          {nextOpponentScout.tape ? (
            <TaleOfTheTape tape={nextOpponentScout.tape} opponent={nextOpponentScout.name} />
          ) : (
            nextOpponentScout.tendencies && <ScoutNumbers t={nextOpponentScout.tendencies} />
          )}
          {nextOpponentScout.keys.length > 0 ? (
            <>
              <ul className="scout-keys" aria-label="Keys to the game">
                {nextOpponentScout.keys.map((k) => (
                  <li key={k.axis}>{k.note}</li>
                ))}
              </ul>
              <ScoutPlanButton keys={nextOpponentScout.keys} gamePlan={gamePlan} onGamePlanChange={onGamePlanChange} />
            </>
              ) : (
                <p className="scout-quiet dim">
                  {nextOpponentScout.tendencies && nextOpponentScout.tendencies.games >= 2
                    ? 'Nothing jumps off the film. Play your game.'
                    : 'Not enough film yet for keys to the game.'}
                </p>
              )}
            </div>
          )}
          {onUseStaffPlan && (
            <div className="staff-plan-row" aria-label="Game plan source">
              {autoGamePlan ? (
                <p>
                  <strong>Staff plan</strong>
                  <span className="dim"> · built around your roster each week. Change a setting to call your own.</span>
                </p>
              ) : (
                <p>
                  <strong>Your plan</strong>
                  <span className="dim"> · the staff&apos;s plan fits the roster best unless you&apos;re scheming for an opponent. </span>
                  <button type="button" className="ghost-btn" onClick={onUseStaffPlan}>
                    Use staff plan
                  </button>
                </p>
              )}
            </div>
          )}
          <label className="gameplan-row">
            <span className="gameplan-label">Offensive Tempo</span>
            <select
              value={gamePlan.tempo}
              onChange={(e) => onGamePlanChange({ ...gamePlan, tempo: e.target.value as OffensiveTempo })}
            >
              {(Object.keys(TEMPO_LABELS) as OffensiveTempo[]).map((tempo) => (
                <option key={tempo} value={tempo}>
                  {TEMPO_LABELS[tempo].label}
                </option>
              ))}
            </select>
          </label>
          <p className="gameplan-hint">{TEMPO_LABELS[gamePlan.tempo].hint}</p>
          <label className="gameplan-row">
            <span className="gameplan-label">Defensive Style</span>
            <select
              value={gamePlan.defense}
              onChange={(e) => onGamePlanChange({ ...gamePlan, defense: e.target.value as DefensiveStyle })}
            >
              {(Object.keys(DEFENSE_LABELS) as DefensiveStyle[]).map((style) => (
                <option key={style} value={style}>
                  {DEFENSE_LABELS[style].label}
                </option>
              ))}
            </select>
          </label>
          <p className="gameplan-hint">{DEFENSE_LABELS[gamePlan.defense].hint}</p>
          <label className="gameplan-row">
            <span className="gameplan-label">Ride</span>
            <select
              value={gamePlan.ride}
              onChange={(e) => onGamePlanChange({ ...gamePlan, ride: e.target.value as RideStyle })}
            >
              {(Object.keys(RIDE_LABELS) as RideStyle[]).map((ride) => (
                <option key={ride} value={ride}>
                  {RIDE_LABELS[ride].label}
                </option>
              ))}
            </select>
          </label>
          <p className="gameplan-hint">{RIDE_LABELS[gamePlan.ride].hint}</p>
          <label className="gameplan-row">
            <span className="gameplan-label">Midfield Rotation</span>
            <select
              value={gamePlan.rotation}
              onChange={(e) => onGamePlanChange({ ...gamePlan, rotation: e.target.value as MidfieldRotation })}
            >
              {(Object.keys(ROTATION_LABELS) as MidfieldRotation[]).map((rotation) => (
                <option key={rotation} value={rotation}>
                  {ROTATION_LABELS[rotation].label}
                </option>
              ))}
            </select>
          </label>
          <p className="gameplan-hint">{ROTATION_LABELS[gamePlan.rotation].hint}</p>
    </>
  );
}

function TaleOfTheTape({ tape, opponent }: { tape: TapeLine[]; opponent: string }) {
  const yours = tape.filter((l) => l.edge === 'user').length;
  const theirs = tape.filter((l) => l.edge === 'opponent').length;
  const rankCell = (value: string, rank: number, edge: boolean) => (
    <td className={edge ? 'tape-edge' : ''}>
      {value} <span className="dim">#{rank}</span>
    </td>
  );
  return (
    <div className="tale-of-tape" aria-label="Tale of the tape">
      <p className="tape-summary">
        Tale of the tape: you hold the edge in <strong>{yours}</strong> of {tape.length}, {opponent} in{' '}
        <strong>{theirs}</strong>.
      </p>
      <table className="tape-table">
        <thead>
          <tr>
            <th>Stat</th>
            <th>You</th>
            <th>Them</th>
          </tr>
        </thead>
        <tbody>
          {tape.map((l) => (
            <tr key={l.key} title={TEAM_STAT_LABELS[l.key]}>
              <td>{TEAM_STAT_SHORT[l.key]}</td>
              {rankCell(formatTeamStat(l.key, l.user.value), l.user.rank, l.edge === 'user')}
              {rankCell(formatTeamStat(l.key, l.opponent.value), l.opponent.rank, l.edge === 'opponent')}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScoutNumbers({ t }: { t: TeamTendencies }) {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const stats = [
    ['GF', t.goalsFor.toFixed(1)],
    ['GA', t.goalsAgainst.toFixed(1)],
    ['SH%', pct(t.shootingPct)],
    ['FO%', pct(t.faceoffPct)],
    ['CLR%', pct(t.clearPct)],
    ['TO', t.turnovers.toFixed(1)],
  ];
  return (
    <div className="scout-numbers" aria-label="Opponent per-game averages">
      {stats.map(([label, value]) => (
        <span key={label} className="scout-num">
          <span className="scout-num-label">{label}</span>
          {value}
        </span>
      ))}
    </div>
  );
}

function ScoutPlanButton({
  keys,
  gamePlan,
  onGamePlanChange,
}: {
  keys: ScoutKey[];
  gamePlan: LacrosseGamePlan;
  onGamePlanChange: (plan: LacrosseGamePlan) => void;
}) {
  const scouted = scoutedGamePlan(keys, gamePlan);
  const applied = keys.every((k) => gamePlan[k.axis] === k.value);
  return (
    <button
      className="scout-plan-btn"
      disabled={applied}
      onClick={() => onGamePlanChange(scouted)}
    >
      {applied ? "Scout's plan in place" : "Use the scout's plan"}
    </button>
  );
}
