import { calculateLacrosseTeamRating } from '@sports-management-sim/sport-lacrosse';
import type { LacrossePosition, LacrosseTeam } from '@sports-management-sim/sport-lacrosse';
import type { Conference, PlayerClass, ScheduledGame } from '@sports-management-sim/engine-core';
import type { RankingEntry } from './rankings';
import type { SeasonStatsMap } from './stats';
import { formatTeamName } from './ui/format';

/**
 * League browser models: flat, sortable rows for every program and every
 * player in the league, the way a management sim's "League → Teams" and
 * "Player Search" menus present them.
 */

export type SortDirection = 'asc' | 'desc';

export interface ProgramRow {
  teamId: string;
  name: string;
  conferenceId: string;
  conferenceName: string;
  prestige: number;
  rank: number | null;
  wins: number;
  losses: number;
  conferenceWins: number;
  conferenceLosses: number;
  goalsFor: number;
  goalsAgainst: number;
  overall: number;
  offense: number;
  defense: number;
  goalie: number;
  faceoff: number;
  rosterSize: number;
  isUser: boolean;
}

export type ProgramSortKey = Exclude<keyof ProgramRow, 'teamId' | 'conferenceId' | 'isUser'>;

export function buildProgramRows(input: {
  teams: LacrosseTeam[];
  conferences: Conference[];
  rankings: RankingEntry[];
  goalTotals: Map<string, { for: number; against: number }>;
  userTeamId: string;
}): ProgramRow[] {
  const confNames = new Map(input.conferences.map((c) => [c.id, c.shortName || c.name]));
  const rankById = new Map(input.rankings.map((r) => [r.teamId, r.rank]));
  return input.teams.map((team) => {
    const rating = calculateLacrosseTeamRating(team);
    const goals = input.goalTotals.get(team.id) ?? { for: 0, against: 0 };
    return {
      teamId: team.id,
      name: formatTeamName(team.name),
      conferenceId: team.conferenceId,
      conferenceName: confNames.get(team.conferenceId) ?? team.conferenceId.toUpperCase(),
      prestige: team.reputation.nationalPrestige,
      rank: rankById.get(team.id) ?? null,
      wins: team.record.wins,
      losses: team.record.losses,
      conferenceWins: team.record.conferenceWins,
      conferenceLosses: team.record.conferenceLosses,
      goalsFor: goals.for,
      goalsAgainst: goals.against,
      overall: rating.overall,
      offense: rating.offense,
      defense: rating.defense,
      goalie: rating.goalie,
      faceoff: rating.faceoff,
      rosterSize: team.roster.length,
      isUser: team.id === input.userTeamId,
    };
  });
}

/** Sum goals for/against per team from final games. */
export function computeGoalTotals(schedule: ScheduledGame[]): Map<string, { for: number; against: number }> {
  const totals = new Map<string, { for: number; against: number }>();
  const bump = (id: string, f: number, a: number) => {
    const t = totals.get(id) ?? { for: 0, against: 0 };
    t.for += f;
    t.against += a;
    totals.set(id, t);
  };
  for (const g of schedule) {
    if (g.status !== 'final' || !g.result) continue;
    bump(g.homeTeamId, g.result.homeScore, g.result.awayScore);
    bump(g.awayTeamId, g.result.awayScore, g.result.homeScore);
  }
  return totals;
}

export interface PlayerRow {
  playerId: string;
  name: string;
  lastName: string;
  teamId: string;
  teamName: string;
  conferenceId: string;
  position: LacrossePosition;
  classYear: PlayerClass;
  overall: number;
  potential: number;
  athleticism: number;
  speed: number;
  skill: number;
  iq: number;
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  groundBalls: number;
  causedTurnovers: number;
  saves: number;
  isUser: boolean;
}

export type PlayerSortKey = Exclude<keyof PlayerRow, 'playerId' | 'teamId' | 'conferenceId' | 'isUser' | 'lastName'>;

export function buildPlayerRows(teams: LacrosseTeam[], seasonStats: SeasonStatsMap, userTeamId: string): PlayerRow[] {
  return teams.flatMap((team) =>
    team.roster.map((p) => {
      const s = seasonStats[p.id];
      const goals = s?.goals ?? 0;
      const assists = s?.assists ?? 0;
      return {
        playerId: p.id,
        name: `${p.name.first} ${p.name.last}`,
        lastName: p.name.last,
        teamId: team.id,
        teamName: formatTeamName(team.name),
        conferenceId: team.conferenceId,
        position: p.position,
        classYear: p.classYear,
        overall: p.ratings.overall,
        potential: p.ratings.potential,
        athleticism: p.ratings.athleticism,
        speed: p.ratings.speed,
        skill: p.ratings.skill,
        iq: p.ratings.iq,
        gamesPlayed: s?.gamesPlayed ?? 0,
        goals,
        assists,
        points: goals + assists,
        groundBalls: s?.groundBalls ?? 0,
        causedTurnovers: s?.causedTurnovers ?? 0,
        saves: s?.saves ?? 0,
        isUser: team.id === userTeamId,
      };
    }),
  );
}

export interface PlayerFilter {
  search?: string;
  position?: LacrossePosition | 'ALL';
  classYear?: PlayerClass | 'ALL';
  conferenceId?: string | 'ALL';
  teamId?: string | 'ALL';
  minOverall?: number;
}

export function filterPlayerRows(rows: PlayerRow[], filter: PlayerFilter): PlayerRow[] {
  const q = filter.search?.trim().toLowerCase() ?? '';
  return rows.filter((r) => {
    if (q && !r.name.toLowerCase().includes(q) && !r.teamName.toLowerCase().includes(q)) return false;
    if (filter.position && filter.position !== 'ALL' && r.position !== filter.position) return false;
    if (filter.classYear && filter.classYear !== 'ALL' && r.classYear !== filter.classYear) return false;
    if (filter.conferenceId && filter.conferenceId !== 'ALL' && r.conferenceId !== filter.conferenceId) return false;
    if (filter.teamId && filter.teamId !== 'ALL' && r.teamId !== filter.teamId) return false;
    if (filter.minOverall !== undefined && r.overall < filter.minOverall) return false;
    return true;
  });
}

/**
 * Stable sort by one column. Strings sort alphabetically, numbers by value;
 * null ranks (unranked teams) always sink to the bottom regardless of direction.
 */
export function sortRows<T, K extends keyof T>(rows: T[], key: K, direction: SortDirection): T[] {
  const sign = direction === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const av = a.row[key];
      const bv = b.row[key];
      if (av === null || av === undefined) return bv === null || bv === undefined ? a.index - b.index : 1;
      if (bv === null || bv === undefined) return -1;
      const cmp = typeof av === 'string' && typeof bv === 'string' ? av.localeCompare(bv) : Number(av) - Number(bv);
      return cmp !== 0 ? cmp * sign : a.index - b.index;
    })
    .map(({ row }) => row);
}

/** Text columns read naturally A→Z; rating/stat columns read best-first. */
export function defaultDirectionFor(value: unknown): SortDirection {
  return typeof value === 'string' ? 'asc' : 'desc';
}
