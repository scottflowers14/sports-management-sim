import type { LacrossePlayer } from '@sports-management-sim/sport-lacrosse';
import type { InjuredPlayer } from '../dynasty-helpers';
import type { PlayerSeasonStats } from '../stats';
import type { PlayerCareer } from '../career-stats';
import { careerTotals } from '../career-stats';
import { cardFromPlayer } from '../player-card-model';
import { PlayerCardPanel } from './PlayerCard';
import { RushBackButton } from './RushBackButton';
import { gameLogColumns, type PlayerGameRow } from '../player-game-log';

export function PlayerPanel({
  player,
  isInjured,
  injuryData,
  playerStats,
  career,
  seasonYear,
  gameLog = [],
  teamShort = (id) => id,
  onRushInjury,
  onClose,
}: {
  player: LacrossePlayer;
  isInjured: boolean;
  injuryData: InjuredPlayer | undefined;
  playerStats: PlayerSeasonStats | undefined;
  career: PlayerCareer | undefined;
  seasonYear: number;
  gameLog?: PlayerGameRow[];
  teamShort?: (teamId: string) => string;
  onRushInjury?: (playerId: string) => void;
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
          {injuryData.description ? ` (${injuryData.description})` : ''}
          {injuryData.rushed ? ' · rushed back' : ''}
          {onRushInjury && <RushBackButton injury={injuryData} onRush={onRushInjury} />}
        </p>
      )}
      {player.ratingHistory && player.ratingHistory.length > 0 && (
        <RatingHistorySection player={player} seasonYear={seasonYear} />
      )}
      {liveStats && <PlayerStatsSection stats={liveStats} position={player.position} seasonYear={seasonYear} />}
      {gameLog.length > 0 && <GameLogSection rows={gameLog} position={player.position} teamShort={teamShort} />}
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

/** Overall rating at the end of each season, ending with today's rating. */
function RatingHistorySection({ player, seasonYear }: { player: LacrossePlayer; seasonYear: number }) {
  const points = [
    ...(player.ratingHistory ?? []).map((h) => ({ label: `${h.season}`, classYear: h.classYear, overall: h.overall })),
    { label: `${seasonYear}`, classYear: player.classYear, overall: player.ratings.overall },
  ];
  const max = Math.max(...points.map((p) => p.overall));
  const min = Math.min(...points.map((p) => p.overall)) - 8;
  return (
    <div className="player-stats-section" aria-label="Rating history">
      <p className="section-label">Development · potential {player.ratings.potential}</p>
      <div className="rating-history">
        {points.map((p, i) => {
          const prev = points[i - 1];
          const delta = prev ? p.overall - prev.overall : null;
          const height = 18 + ((p.overall - min) / Math.max(1, max - min)) * 42;
          return (
            <div key={p.label} className="rating-history-col">
              <span className={`rating-history-delta${delta === null ? '' : delta > 0 ? ' positive' : delta < 0 ? ' negative' : ''}`}>
                {delta === null ? '' : delta > 0 ? `+${delta}` : delta}
              </span>
              <div className="rating-history-bar" style={{ height }}>
                <span>{p.overall}</span>
              </div>
              <span className="rating-history-label">
                {p.classYear} · {p.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GameLogSection({ rows, position, teamShort }: { rows: PlayerGameRow[]; position: string; teamShort: (id: string) => string }) {
  const columns = gameLogColumns(position);
  return (
    <div className="player-stats-section" aria-label="Game log">
      <p className="section-label">Game Log</p>
      <div className="game-log-wrap">
      <table className="standings-table career-table game-log-table">
        <thead>
          <tr>
            <th>Wk</th>
            <th>Opp</th>
            <th>Result</th>
            {columns.map((c) => (
              <th key={c.label}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.gameId}>
              <td className="rank">{r.week}</td>
              <td>
                {r.home ? '' : '@'}
                {teamShort(r.opponentId)}
              </td>
              <td className={r.won ? 'game-log-win' : 'game-log-loss'}>
                {r.won ? 'W' : 'L'} {r.score}
                {r.overtime ? ' OT' : ''}
              </td>
              {columns.map((c) => (
                <td key={c.label} className="stat-val">
                  {c.value(r.line)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
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
