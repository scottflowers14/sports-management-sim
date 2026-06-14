import type { LacrossePlayer } from '@sports-management-sim/sport-lacrosse';
import type { InjuredPlayer } from '../dynasty-helpers';
import type { PlayerSeasonStats } from '../stats';
import type { PlayerCareer } from '../career-stats';
import { careerTotals } from '../career-stats';

export function PlayerPanel({
  player,
  isInjured,
  injuryData,
  playerStats,
  career,
  seasonYear,
  onClose,
}: {
  player: LacrossePlayer;
  isInjured: boolean;
  injuryData: InjuredPlayer | undefined;
  playerStats: PlayerSeasonStats | undefined;
  career: PlayerCareer | undefined;
  seasonYear: number;
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
          <PlayerStatsSection stats={playerStats} position={player.position} seasonYear={seasonYear} />
        )}
        {(career && career.seasons.length > 0) || (playerStats && playerStats.gamesPlayed > 0) ? (
          <CareerSection
            career={career}
            position={player.position}
            seasonYear={seasonYear}
            liveStats={playerStats && playerStats.gamesPlayed > 0 ? playerStats : undefined}
          />
        ) : null}
      </aside>
    </div>
  );
}

type StatColumn = { label: string; value: (s: PlayerSeasonStats) => number; unit?: string };

function columnsForPosition(position: string): StatColumn[] {
  if (position === 'GK') {
    return [
      { label: 'SV', value: (s) => s.saves },
      { label: 'GA', value: (s) => s.goalsAllowed },
      { label: 'SV%', value: (s) => (s.saves + s.goalsAllowed > 0 ? Math.round((s.saves / (s.saves + s.goalsAllowed)) * 100) : 0), unit: '%' },
    ];
  }
  if (position === 'FOGO') {
    return [
      { label: 'FW', value: (s) => s.faceoffWins },
      { label: 'FA', value: (s) => s.faceoffAttempts },
      { label: 'FO%', value: (s) => (s.faceoffAttempts > 0 ? Math.round((s.faceoffWins / s.faceoffAttempts) * 100) : 0), unit: '%' },
    ];
  }
  if (position === 'ATT' || position === 'MID') {
    return [
      { label: 'G', value: (s) => s.goals },
      { label: 'A', value: (s) => s.assists },
      { label: 'PTS', value: (s) => s.goals + s.assists },
      { label: 'SH', value: (s) => s.shots },
      { label: 'GB', value: (s) => s.groundBalls },
    ];
  }
  // DEF / LSM
  return [
    { label: 'CT', value: (s) => s.causedTurnovers },
    { label: 'GB', value: (s) => s.groundBalls },
    { label: 'TO', value: (s) => s.turnovers },
  ];
}

function PlayerStatsSection({ stats, position, seasonYear }: { stats: PlayerSeasonStats; position: string; seasonYear: number }) {
  const columns = columnsForPosition(position);
  return (
    <div className="player-stats-section">
      <p className="section-label">{seasonYear} Season · {stats.gamesPlayed} GP</p>
      <div className="player-stats-grid">
        {columns.map((col) => (
          <StatChip key={col.label} label={col.label} value={col.value(stats)} unit={col.unit ?? ''} />
        ))}
      </div>
    </div>
  );
}

function CareerSection({
  career,
  position,
  seasonYear,
  liveStats,
}: {
  career: PlayerCareer | undefined;
  position: string;
  seasonYear: number;
  liveStats: PlayerSeasonStats | undefined;
}) {
  const columns = columnsForPosition(position);
  const completedSeasons = career?.seasons ?? [];
  const totals = careerTotals(career, liveStats);
  // Only worth showing a multi-row career table once there's more than one season.
  const totalSeasons = completedSeasons.length + (liveStats ? 1 : 0);
  if (totalSeasons < 2) return null;

  return (
    <div className="player-stats-section">
      <p className="section-label">Career</p>
      <table className="standings-table career-table">
        <thead>
          <tr>
            <th>Yr</th>
            <th>Cls</th>
            <th>GP</th>
            {columns.map((col) => <th key={col.label}>{col.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {completedSeasons.map((line) => (
            <tr key={line.year}>
              <td className="rank">{line.year}</td>
              <td className="dim">{line.classYear}</td>
              <td>{line.stats.gamesPlayed}</td>
              {columns.map((col) => <td key={col.label} className="stat-val">{col.value(line.stats)}{col.unit ?? ''}</td>)}
            </tr>
          ))}
          {liveStats && (
            <tr className="career-live-row">
              <td className="rank">{seasonYear}*</td>
              <td className="dim">—</td>
              <td>{liveStats.gamesPlayed}</td>
              {columns.map((col) => <td key={col.label} className="stat-val">{col.value(liveStats)}{col.unit ?? ''}</td>)}
            </tr>
          )}
          <tr className="career-total-row">
            <td className="rank">Car</td>
            <td className="dim">—</td>
            <td>{totals.gamesPlayed}</td>
            {columns.map((col) => <td key={col.label} className="stat-val">{col.value(totals)}{col.unit ?? ''}</td>)}
          </tr>
        </tbody>
      </table>
      {liveStats && <p className="dim career-note">* current season in progress</p>}
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
