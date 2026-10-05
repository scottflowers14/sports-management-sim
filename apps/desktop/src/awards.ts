import type { LacrosseSeason } from '@sports-management-sim/sport-lacrosse';
import type { PlayerSeasonStats, SeasonStatsMap } from './stats';

export interface AwardWinner {
  playerId?: string;
  teamId?: string;
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
  /** First, second and third team All-America; absent on older saves. */
  allAmerica?: AllAmericaTeams;
}

export interface AllAmericaTeams {
  first: AwardWinner[];
  second: AwardWinner[];
  third: AwardWinner[];
}

export type AllAmericaTier = keyof AllAmericaTeams;

export const ALL_AMERICA_TIERS: AllAmericaTier[] = ['first', 'second', 'third'];

export const ALL_AMERICA_TIER_LABELS: Record<AllAmericaTier, string> = {
  first: '1st Team All-America',
  second: '2nd Team All-America',
  third: '3rd Team All-America',
};

/** Seats per position on each All-America team: twelve players a team. */
export const ALL_AMERICA_SLOTS: ReadonlyArray<[string, number]> = [
  ['ATT', 3],
  ['MID', 3],
  ['DEF', 3],
  ['LSM', 1],
  ['GK', 1],
  ['FOGO', 1],
];

/**
 * Three All-America teams: the best at each position fill the first team's
 * seats, the next best the second, and so on.
 */
function buildAllAmerica(
  allPlayers: PlayerWithTeam[],
  pick: (position: string) => { score: (e: PlayerWithTeam) => number; line?: (e: PlayerWithTeam) => string },
): AllAmericaTeams {
  const teams: AllAmericaTeams = { first: [], second: [], third: [] };
  for (const [position, seats] of ALL_AMERICA_SLOTS) {
    const { score, line } = pick(position);
    const ranked = allPlayers
      .filter((e) => e.player.position === position)
      .map((e) => ({ e, score: score(e) }))
      .sort((a, b) => b.score - a.score || b.e.player.ratings.overall - a.e.player.ratings.overall);
    ALL_AMERICA_TIERS.forEach((tier, t) => {
      for (const { e } of ranked.slice(t * seats, (t + 1) * seats)) teams[tier].push(buildAwardWinner(e, line?.(e)));
    });
  }
  return teams;
}

/** A program's All-Americans, best tier first. */
export function programAllAmericans(
  teams: AllAmericaTeams | undefined,
  teamId: string,
): Array<{ tier: AllAmericaTier; winner: AwardWinner }> {
  if (!teams) return [];
  return ALL_AMERICA_TIERS.flatMap((tier) => teams[tier].filter((w) => w.teamId === teamId).map((winner) => ({ tier, winner })));
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
  return defensiveProduction(entry.player.position, entry.stats);
}

/**
 * One scale for defensemen and goalies. A goalie makes saves every game, so
 * only his save rate above the norm counts; raw saves alone would hand every
 * defensive award to a goalie.
 */
export function defensiveProduction(
  position: string,
  stats: Pick<PlayerSeasonStats, 'saves' | 'goalsAllowed' | 'causedTurnovers' | 'groundBalls'>,
): number {
  if (position === 'GK') {
    const faced = stats.saves + stats.goalsAllowed;
    return faced > 0 ? stats.saves * Math.max(0, stats.saves / faced - 0.45) * 2.6 : 0;
  }
  return stats.causedTurnovers * 3 + stats.groundBalls * 0.5;
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

  const races = raceDefinitions(winPctByTeam);
  const mvpEntry = maxBy(allPlayers.filter(races.mvp.eligible), races.mvp.score);
  const offEntry = maxBy(allPlayers.filter(races.offensive.eligible), races.offensive.score);
  const defEntry = maxBy(allPlayers.filter(races.defensive.eligible), races.defensive.score);
  const freshmanEntry = maxBy(allPlayers.filter(races.freshman.eligible), races.freshman.score);

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
    allAmerica: buildAllAmerica(allPlayers, (position) => {
      const [, score, line] = positionPicks.find(([pos]) => pos === position)!;
      // Voters lean a little toward winners: from 0.8x on a winless team to 1.2x unbeaten.
      return { score: (e) => score(e) * (0.8 + 0.4 * (winPctByTeam.get(e.team.id) ?? 0)), line };
    }),
  };
}

type AwardRaceKey = 'mvp' | 'offensive' | 'defensive' | 'freshman';

interface RaceDefinition {
  eligible: (entry: PlayerWithTeam) => boolean;
  score: (entry: PlayerWithTeam) => number;
  line: (entry: PlayerWithTeam) => string;
}

/**
 * How each award is decided. The season-end winners and the in-season race
 * share these, so whoever leads the race on the last week wins the award.
 */
function raceDefinitions(winPctByTeam: ReadonlyMap<string, number>): Record<AwardRaceKey, RaceDefinition> {
  return {
    // MVP: production weighted toward players who carried winning teams
    mvp: {
      eligible: (e) => points(e) > 0,
      score: (e) => points(e) + (winPctByTeam.get(e.team.id) ?? 0) * 10,
      line: scoringLine,
    },
    offensive: {
      eligible: (e) => e.player.position === 'ATT' || e.player.position === 'MID',
      score: points,
      line: scoringLine,
    },
    defensive: {
      eligible: (e) => ['DEF', 'LSM', 'GK'].includes(e.player.position),
      score: defensiveScore,
      line: defensiveLine,
    },
    freshman: {
      eligible: (e) => e.player.classYear === 'FR' && points(e) > 0,
      score: points,
      line: scoringLine,
    },
  };
}

export const AWARD_RACE_LABELS: Record<AwardRaceKey, string> = {
  mvp: 'Player of the Year',
  offensive: 'Offensive Player',
  defensive: 'Defensive Player',
  freshman: 'Freshman of the Year',
};

export const AWARD_RACE_KEYS: AwardRaceKey[] = ['mvp', 'offensive', 'defensive', 'freshman'];

export interface AwardRaceEntry {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  position: string;
  statLine: string;
  /** Weekly honors (Player of the Week) won this season. */
  weeklyHonors: number;
  score: number;
}

export type AwardsRace = Record<AwardRaceKey, AwardRaceEntry[]>;

/**
 * The OOTP-style awards race: the current leaders for each season award, by
 * the same measure that decides the winners at season's end.
 */
export function computeAwardsRace(
  season: LacrosseSeason,
  seasonStats: SeasonStatsMap,
  weeklyHonorsByPlayer: Readonly<Record<string, number>> = {},
  limit = 5,
): AwardsRace {
  const allPlayers: PlayerWithTeam[] = [];
  for (const team of season.teams) {
    for (const player of team.roster) {
      const stats = seasonStats[player.id];
      if (stats && stats.gamesPlayed > 0) allPlayers.push({ player, team, stats });
    }
  }
  const winPctByTeam = new Map(
    season.teams.map((team) => {
      const games = team.record.wins + team.record.losses;
      return [team.id, games > 0 ? team.record.wins / games : 0];
    }),
  );
  const races = raceDefinitions(winPctByTeam);
  const race = (key: AwardRaceKey): AwardRaceEntry[] => {
    const { eligible, score, line } = races[key];
    return allPlayers
      .filter(eligible)
      .map((entry) => ({ entry, score: score(entry) }))
      .filter(({ score: s }) => s > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ entry, score: s }) => ({
        playerId: entry.player.id,
        playerName: `${entry.player.name.first} ${entry.player.name.last}`,
        teamId: entry.team.id,
        teamName: entry.team.name,
        position: entry.player.position,
        statLine: line(entry),
        weeklyHonors: weeklyHonorsByPlayer[entry.player.id] ?? 0,
        score: s,
      }));
  };
  return { mvp: race('mvp'), offensive: race('offensive'), defensive: race('defensive'), freshman: race('freshman') };
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
    allPlayers.filter((e) => e.player.classYear === 'FR'),
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
    allAmerica: buildAllAmerica(allPlayers, () => ({ score: overall })),
  };
}

// ── shared helpers ──────────────────────────────────────────────────────────

function buildAwardWinner(entry: PlayerWithTeam, statLine?: string): AwardWinner {
  return {
    playerId: entry.player.id,
    teamId: entry.team.id,
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
