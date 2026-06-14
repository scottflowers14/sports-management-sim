import type { LacrossePlayer } from '@sports-management-sim/sport-lacrosse';
import type { InjuredPlayer } from '../dynasty-helpers';
import type { PlayerSeasonStats } from '../stats';
import type { PlayerCareer } from '../career-stats';
import { careerTotals } from '../career-stats';
import { cardFromPlayer } from '../player-card-model';
import { PlayerCardPanel } from './PlayerCard';

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
  const data = cardFromPlayer(player, { injured: isInjured });
  const hasLiveStats = Boolean(playerStats && playerStats.gamesPlayed > 0);
  const liveStats = hasLiveStats ? playerStats : undefined;

  const footer = (
    <>
      {isInjured && injuryData && (
        <p className="injury-status">
          Out {injuryData.weeksRemaining} more week{injuryData.weeksRemaining > 1 ? 's' : ''}
        </p>
      )}
      {liveStats && <PlayerStatsSection stats={liveStats} position={player.position} seasonYear={seasonYear} />}
      {((career && career.seasons.length > 0) || liveStats) && (
        <CareerSection
          career={career}
          position={player.position}
          seasonYear={seasonYear}
          liveStats={liveStats}
        />
      )}
    </>
  );

  return <PlayerCardPanel data={data} footer={footer} onClose={onClose} />;
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
