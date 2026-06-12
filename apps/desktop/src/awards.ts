import type { LacrosseSeason } from '@sports-management-sim/sport-lacrosse';
import type { PlayerSeasonStats, SeasonStatsMap } from './stats';

export interface AwardWinner {
  playerName: string;
  teamName: string;
  position: string;
  overall: number;
  /** Season production line, e.g. "34G, 21A" — present when stat-based awards were computed. */
  statLine?: string;
}

export interface SeasonAwards {
  seasonYear: number;
  mvp: AwardWinner;
  offensivePlayer: AwardWinner;
  defensivePlayer: AwardWinner;
  freshmanOfYear: AwardWinner | null;
  allConference: AwardWinner[];
}

type PlayerWithTeam = {
  player: LacrosseSeason['teams'][0]['roster'][0];
  team: LacrosseSeason['teams'][0];
  stats: PlayerSeasonStats | null;
};

export function computeSeasonAwards(
  season: LacrosseSeason,
  _userTeamId: string,
  seasonStats?: SeasonStatsMap,
): SeasonAwards {
  const allPlayers: PlayerWithTeam[] = [];
  for (const team of season.teams) {
    for (const player of team.roster) {
      allPlayers.push({ player, team, stats: seasonStats?.[player.id] ?? null });
    }
  }

  const hasStats = allPlayers.some((e) => e.stats !== null && e.stats.gamesPlayed > 0);

  return hasStats
    ? computeStatBasedAwards(season, allPlayers)
    : computeRatingBasedAwards(season, allPlayers);
}

// ── stat-based awards ───────────────────────────────────────────────────────

function points(entry: PlayerWithTeam): number {
  return (entry.stats?.goals ?? 0) + (entry.stats?.assists ?? 0);
}

function defensiveScore(entry: PlayerWithTeam): number {
  if (!entry.stats) return 0;
  if (entry.player.position === 'GK') {
    const { saves, goalsAllowed } = entry.stats;
    const savePct = saves + goalsAllowed > 0 ? saves / (saves + goalsAllowed) : 0;
    return saves * (0.5 + savePct);
  }
  return entry.stats.causedTurnovers * 3 + entry.stats.groundBalls * 0.5;
}

function scoringLine(entry: PlayerWithTeam): string {
  return `${entry.stats?.goals ?? 0}G, ${entry.stats?.assists ?? 0}A`;
}

function defensiveLine(entry: PlayerWithTeam): string {
  if (entry.player.position === 'GK') return `${entry.stats?.saves ?? 0} saves`;
  return `${entry.stats?.causedTurnovers ?? 0} CT, ${entry.stats?.groundBalls ?? 0} GB`;
}

function faceoffLine(entry: PlayerWithTeam): string {
  const wins = entry.stats?.faceoffWins ?? 0;
  const attempts = entry.stats?.faceoffAttempts ?? 0;
  const pct = attempts > 0 ? Math.round((wins / attempts) * 100) : 0;
  return `${wins} FO wins (${pct}%)`;
}

function computeStatBasedAwards(season: LacrosseSeason, allPlayers: PlayerWithTeam[]): SeasonAwards {
  const winPctByTeam = new Map(
    season.teams.map((team) => {
      const games = team.record.wins + team.record.losses;
      return [team.id, games > 0 ? team.record.wins / games : 0];
    }),
  );

  // MVP: production weighted toward players who carried winning teams
  const mvpEntry = maxBy(
    allPlayers.filter((e) => points(e) > 0),
    (e) => points(e) + (winPctByTeam.get(e.team.id) ?? 0) * 10,
  );

  const offEntry = maxBy(
    allPlayers.filter((e) => e.player.position === 'ATT' || e.player.position === 'MID'),
    points,
  );

  const defEntry = maxBy(
    allPlayers.filter((e) => ['DEF', 'LSM', 'GK'].includes(e.player.position)),
    defensiveScore,
  );

  const freshmanEntry = maxBy(
    allPlayers.filter((e) => (e.player.classYear === 'FR' || e.player.classYear === 'SO') && points(e) > 0),
    points,
  );

  if (!mvpEntry || !offEntry || !defEntry) {
    // Stats exist but nobody qualifies (shouldn't happen in practice) — fall back
    return computeRatingBasedAwards(season, allPlayers);
  }

  const allConference: AwardWinner[] = [];
  const positionPicks: Array<[string, (e: PlayerWithTeam) => number, (e: PlayerWithTeam) => string]> = [
    ['ATT', points, scoringLine],
    ['MID', points, scoringLine],
    ['DEF', defensiveScore, defensiveLine],
    ['LSM', defensiveScore, defensiveLine],
    ['GK', defensiveScore, defensiveLine],
    ['FOGO', (e) => e.stats?.faceoffWins ?? 0, faceoffLine],
  ];
  for (const [pos, scoreFn, lineFn] of positionPicks) {
    const best = maxBy(allPlayers.filter((e) => e.player.position === pos), scoreFn);
    if (best) allConference.push(buildAwardWinner(best, lineFn(best)));
  }

  return {
    seasonYear: season.year,
    mvp: buildAwardWinner(mvpEntry, scoringLine(mvpEntry)),
    offensivePlayer: buildAwardWinner(offEntry, scoringLine(offEntry)),
    defensivePlayer: buildAwardWinner(defEntry, defensiveLine(defEntry)),
    freshmanOfYear: freshmanEntry ? buildAwardWinner(freshmanEntry, scoringLine(freshmanEntry)) : null,
    allConference,
  };
}

// ── ratings fallback (no stats available) ───────────────────────────────────

function computeRatingBasedAwards(season: LacrosseSeason, allPlayers: PlayerWithTeam[]): SeasonAwards {
  const overall = (e: PlayerWithTeam) => e.player.ratings.overall;

  // MVP: highest overall among players on the team with the most wins
  const sortedByWins = [...season.teams].sort((a, b) => b.record.wins - a.record.wins);
  const topTeam = sortedByWins[0];
  const mvpCandidates = topTeam !== undefined
    ? allPlayers.filter((entry) => entry.team.id === topTeam.id)
    : allPlayers;
  const mvpEntry = maxBy(mvpCandidates, overall) ?? maxBy(allPlayers, overall);

  if (!mvpEntry) {
    throw new Error('No players found to compute MVP');
  }

  const offEntry = maxBy(
    allPlayers.filter((e) => e.player.position === 'ATT' || e.player.position === 'MID'),
    overall,
  );
  if (!offEntry) {
    throw new Error('No offensive players found');
  }

  const defEntry = maxBy(
    allPlayers.filter((e) => ['DEF', 'GK', 'LSM'].includes(e.player.position)),
    overall,
  );
  if (!defEntry) {
    throw new Error('No defensive players found');
  }

  const freshmanEntry = maxBy(
    allPlayers.filter((e) => e.player.classYear === 'FR' || e.player.classYear === 'SO'),
    overall,
  );

  const allConference: AwardWinner[] = [];
  for (const pos of ['ATT', 'MID', 'DEF', 'GK'] as const) {
    const best = maxBy(allPlayers.filter((e) => e.player.position === pos), overall);
    if (best) allConference.push(buildAwardWinner(best));
  }

  return {
    seasonYear: season.year,
    mvp: buildAwardWinner(mvpEntry),
    offensivePlayer: buildAwardWinner(offEntry),
    defensivePlayer: buildAwardWinner(defEntry),
    freshmanOfYear: freshmanEntry ? buildAwardWinner(freshmanEntry) : null,
    allConference,
  };
}

// ── shared helpers ──────────────────────────────────────────────────────────

function buildAwardWinner(entry: PlayerWithTeam, statLine?: string): AwardWinner {
  return {
    playerName: `${entry.player.name.first} ${entry.player.name.last}`,
    teamName: entry.team.name,
    position: entry.player.position,
    overall: entry.player.ratings.overall,
    ...(statLine !== undefined ? { statLine } : {}),
  };
}

function maxBy<T>(items: T[], score: (item: T) => number): T | null {
  let best: T | null = null;
  let bestScore = -Infinity;
  for (const item of items) {
    const s = score(item);
    if (s > bestScore) {
      best = item;
      bestScore = s;
    }
  }
  return best;
}
