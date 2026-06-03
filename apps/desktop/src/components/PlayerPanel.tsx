import type { LacrossePlayer } from '@sports-management-sim/sport-lacrosse';
import type { InjuredPlayer } from '../dynasty-helpers';
import type { PlayerSeasonStats } from '../stats';

export function PlayerPanel({
  player,
  isInjured,
  injuryData,
  playerStats,
  onClose,
}: {
  player: LacrossePlayer;
  isInjured: boolean;
  injuryData: InjuredPlayer | undefined;
  playerStats: PlayerSeasonStats | undefined;
  onClose: () => void;
}) {
  return (
    <div className="player-panel-backdrop" onClick={onClose}>
      <aside className="player-panel card" onClick={(e) => e.stopPropagation()}>
        <button
          className="panel-close"
          onClick={onClose}
          aria-label="Close player panel"
        >×</button>
        <div>
          <p className="panel-name">
            {player.name.first} {player.name.last}
            {isInjured && <span className="inj-badge inj-badge-lg">INJ</span>}
          </p>
          <p className="panel-meta">{player.position} · {player.classYear} · {player.hometown}</p>
          {isInjured && injuryData && (
            <p className="injury-status">
              Out {injuryData.weeksRemaining} more week{injuryData.weeksRemaining > 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="ovr-block">
          <div className="ovr-stat">
            <div className="ovr-num">{player.ratings.overall}</div>
            <div className="ovr-label">Overall</div>
          </div>
          <div className="ovr-stat">
            <div className="ovr-num">{player.ratings.potential}</div>
            <div className="ovr-label">Potential</div>
          </div>
        </div>
        <div>
          {(
            [
              ['Athleticism', player.ratings.athleticism],
              ['Speed', player.ratings.speed],
              ['Strength', player.ratings.strength],
              ['Skill', player.ratings.skill],
              ['IQ', player.ratings.iq],
              ['Work Ethic', player.ratings.workEthic],
            ] as [string, number][]
          ).map(([label, value]) => (
            <div key={label} className="rating-row">
              <span>{label}</span>
              <div className="rating-bar-wrap">
                <div className="rating-bar-fill" style={{ width: `${value}%` }} />
              </div>
              <span className="rating-val">{value}</span>
            </div>
          ))}
        </div>
        {player.traits.length > 0 && (
          <div className="trait-list">
            {player.traits.map((trait) => (
              <span key={trait} className="trait-chip">{trait.replace(/_/g, ' ')}</span>
            ))}
          </div>
        )}
        {playerStats && playerStats.gamesPlayed > 0 && (
          <PlayerStatsSection stats={playerStats} position={player.position} />
        )}
      </aside>
    </div>
  );
}

function PlayerStatsSection({ stats, position }: { stats: PlayerSeasonStats; position: string }) {
  const isGk = position === 'GK';
  const isFogo = position === 'FOGO';
  const isOff = position === 'ATT' || position === 'MID';
  const isDef = position === 'DEF' || position === 'LSM';

  return (
    <div className="player-stats-section">
      <p className="section-label">{new Date().getFullYear()} Season · {stats.gamesPlayed} GP</p>
      <div className="player-stats-grid">
        {isGk && (
          <>
            <StatChip label="SV" value={stats.saves} />
            <StatChip label="GA" value={stats.goalsAllowed} />
            <StatChip label="SV%" value={stats.saves + stats.goalsAllowed > 0 ? Math.round(stats.saves / (stats.saves + stats.goalsAllowed) * 100) : 0} unit="%" />
          </>
        )}
        {isFogo && (
          <>
            <StatChip label="FW" value={stats.faceoffWins} />
            <StatChip label="FA" value={stats.faceoffAttempts} />
            <StatChip label="FO%" value={stats.faceoffAttempts > 0 ? Math.round(stats.faceoffWins / stats.faceoffAttempts * 100) : 0} unit="%" />
          </>
        )}
        {isOff && (
          <>
            <StatChip label="G" value={stats.goals} />
            <StatChip label="A" value={stats.assists} />
            <StatChip label="PTS" value={stats.goals + stats.assists} />
            <StatChip label="SH" value={stats.shots} />
          </>
        )}
        {isDef && (
          <StatChip label="CT" value={stats.causedTurnovers} />
        )}
        {!isGk && !isFogo && (
          <StatChip label="GB" value={stats.groundBalls} />
        )}
      </div>
    </div>
  );
}

function StatChip({ label, value, unit = '' }: { label: string; value: number; unit?: string }) {
  return (
    <div className="stat-chip">
      <div className="stat-chip-num">{value}{unit}</div>
      <div className="stat-chip-label">{label}</div>
    </div>
  );
}
