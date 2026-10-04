import type { LacrosseTeam } from '@sports-management-sim/sport-lacrosse';
import { recordSeasonToCareer, type CareerStatsMap } from './career-stats';
import type { PlayerSeasonStats, SeasonStatsMap } from './stats';

export type RecordStat = 'points' | 'goals' | 'assists' | 'groundBalls' | 'causedTurnovers' | 'faceoffWins' | 'saves';

export const RECORD_STATS: { key: RecordStat; label: string }[] = [
  { key: 'points', label: 'Points' },
  { key: 'goals', label: 'Goals' },
  { key: 'assists', label: 'Assists' },
  { key: 'groundBalls', label: 'Ground Balls' },
  { key: 'causedTurnovers', label: 'Caused Turnovers' },
  { key: 'faceoffWins', label: 'Faceoff Wins' },
  { key: 'saves', label: 'Saves' },
];

export interface RecordEntry {
  playerId: string;
  name: string;
  position: string;
  /** Raw team name — format with formatTeamName for display. */
  teamName: string;
  value: number;
  /** The season for a single-season record; the first and last seasons for a career. */
  firstYear: number;
  lastYear: number;
  /** Includes the season still being played. */
  inProgress: boolean;
}

export function statValue(stats: PlayerSeasonStats, stat: RecordStat): number {
  return stat === 'points' ? stats.goals + stats.assists : stats[stat];
}

/**
 * Every career with the season in progress folded in, so a player chasing a
 * record shows up before the season is over.
 */
export function careersWithLiveSeason(
  careers: CareerStatsMap,
  seasonStats: SeasonStatsMap,
  teams: LacrosseTeam[],
  year: number,
): CareerStatsMap {
  return recordSeasonToCareer(careers, seasonStats, teams, year);
}

interface RecordOptions {
  /** One program's records; all programs when left out. */
  teamName?: string;
  limit?: number;
  /** The season in progress, flagged on its entries. */
  liveYear?: number;
}

function rank(entries: RecordEntry[], limit: number): RecordEntry[] {
  return entries
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value || a.firstYear - b.firstYear || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** The best single seasons for a stat. */
export function singleSeasonRecords(careers: CareerStatsMap, stat: RecordStat, options: RecordOptions = {}): RecordEntry[] {
  const entries: RecordEntry[] = [];
  for (const career of Object.values(careers)) {
    for (const line of career.seasons) {
      if (options.teamName !== undefined && line.teamName !== options.teamName) continue;
      entries.push({
        playerId: career.playerId,
        name: career.name,
        position: line.position,
        teamName: line.teamName,
        value: statValue(line.stats, stat),
        firstYear: line.year,
        lastYear: line.year,
        inProgress: line.year === options.liveYear,
      });
    }
  }
  return rank(entries, options.limit ?? 5);
}

/**
 * The best careers for a stat. For one program, only the seasons a player
 * spent there count, so a transfer's numbers stay with the school he made them at.
 */
export function careerRecords(careers: CareerStatsMap, stat: RecordStat, options: RecordOptions = {}): RecordEntry[] {
  const entries: RecordEntry[] = [];
  for (const career of Object.values(careers)) {
    const lines = career.seasons.filter((l) => options.teamName === undefined || l.teamName === options.teamName);
    if (lines.length === 0) continue;
    const last = lines[lines.length - 1]!;
    entries.push({
      playerId: career.playerId,
      name: career.name,
      position: last.position,
      teamName: last.teamName,
      value: lines.reduce((sum, l) => sum + statValue(l.stats, stat), 0),
      firstYear: lines[0]!.year,
      lastYear: last.year,
      inProgress: lines.some((l) => l.year === options.liveYear),
    });
  }
  return rank(entries, options.limit ?? 5);
}

export type RecordKind = 'season' | 'career';

/** Records kept for one scope (the whole league, or one program). */
export type ScopeRecords = Record<RecordKind, Partial<Record<RecordStat, RecordEntry[]>>>;

/**
 * Saved records, by scope: 'league' plus every program the user has coached.
 * Career stats for departed players are pruned from saves, so the leaders
 * are kept here instead.
 */
export type RecordBookArchive = Record<string, ScopeRecords>;

export const LEAGUE_SCOPE = 'league';
export const RECORD_LIST_LENGTH = 10;

function entryKey(entry: RecordEntry, kind: RecordKind): string {
  return kind === 'season' ? `${entry.playerId}:${entry.firstYear}:${entry.teamName}` : entry.playerId;
}

/** Combine saved leaders with ones computed from current careers; current numbers win. */
export function mergeRecords(
  archived: readonly RecordEntry[] | undefined,
  computed: readonly RecordEntry[],
  kind: RecordKind,
  limit = RECORD_LIST_LENGTH,
): RecordEntry[] {
  const byKey = new Map<string, RecordEntry>();
  for (const entry of archived ?? []) byKey.set(entryKey(entry, kind), { ...entry, inProgress: false });
  for (const entry of computed) byKey.set(entryKey(entry, kind), entry);
  return rank([...byKey.values()], limit);
}

/** Every list for one scope: saved leaders plus the careers on hand. */
export function scopeRecords(
  archive: RecordBookArchive,
  scope: string,
  careers: CareerStatsMap,
  liveYear?: number,
): ScopeRecords {
  const saved = archive[scope];
  const options = {
    ...(scope === LEAGUE_SCOPE ? {} : { teamName: scope }),
    limit: RECORD_LIST_LENGTH,
    ...(liveYear !== undefined ? { liveYear } : {}),
  };
  const result: ScopeRecords = { season: {}, career: {} };
  for (const { key } of RECORD_STATS) {
    result.season[key] = mergeRecords(saved?.season[key], singleSeasonRecords(careers, key, options), 'season');
    result.career[key] = mergeRecords(saved?.career[key], careerRecords(careers, key, options), 'career');
  }
  return result;
}

/** Fold a finished season into the saved records for the given scopes. */
export function archiveRecords(archive: RecordBookArchive, careers: CareerStatsMap, scopes: readonly string[]): RecordBookArchive {
  const next = { ...archive };
  for (const scope of new Set([LEAGUE_SCOPE, ...scopes])) next[scope] = scopeRecords(archive, scope, careers);
  return next;
}

/**
 * Headlines for records that just fell: the top spot passed from an earlier
 * season's holder to a player this season, outright (a tie isn't a record).
 * A record set in the dynasty's first season has nothing to break, so it
 * makes no news.
 */
export function brokenRecordHeadlines(before: ScopeRecords, after: ScopeRecords, scopeLabel: string, liveYear: number): string[] {
  const headlines: string[] = [];
  for (const kind of ['season', 'career'] as const) {
    for (const { key, label } of RECORD_STATS) {
      const previous = before[kind][key]?.[0];
      const current = after[kind][key]?.[0];
      if (!previous || !current || !current.inProgress) continue;
      if (current.playerId === previous.playerId || current.value <= previous.value) continue;
      if (previous.lastYear >= liveYear) continue;
      // Early on, a career record is a season or two of numbers; it makes news
      // once it belongs to someone who played at least three.
      if (kind === 'career' && previous.lastYear - previous.firstYear < 2) continue;
      const what = kind === 'season' ? `single-season ${label.toLowerCase()}` : `career ${label.toLowerCase()}`;
      headlines.push(
        `Record book: ${current.position} ${current.name} breaks the ${scopeLabel} ${what} record with ${current.value}, passing ${previous.name} (${previous.value}, ${years(previous)})`,
      );
    }
  }
  return headlines;
}

function years(entry: RecordEntry): string {
  return entry.firstYear === entry.lastYear ? `${entry.firstYear}` : `${entry.firstYear}–${entry.lastYear}`;
}

export interface RecordWeekInput {
  archive: RecordBookArchive;
  careers: CareerStatsMap;
  year: number;
  /** The user's program, raw name, and how headlines should name it. */
  programName: string;
  programLabel: string;
  before: { seasonStats: SeasonStatsMap; teams: LacrosseTeam[] };
  after: { seasonStats: SeasonStatsMap; teams: LacrosseTeam[] };
}

/** Program and league records that fell during a simulated week. */
export function recordNewsForWeek(input: RecordWeekInput): string[] {
  const { archive, careers, year } = input;
  const beforeCareers = careersWithLiveSeason(careers, input.before.seasonStats, input.before.teams, year);
  const afterCareers = careersWithLiveSeason(careers, input.after.seasonStats, input.after.teams, year);
  return [
    ...brokenRecordHeadlines(
      scopeRecords(archive, input.programName, beforeCareers, year),
      scopeRecords(archive, input.programName, afterCareers, year),
      input.programLabel,
      year,
    ),
    ...brokenRecordHeadlines(
      scopeRecords(archive, LEAGUE_SCOPE, beforeCareers, year),
      scopeRecords(archive, LEAGUE_SCOPE, afterCareers, year),
      'league',
      year,
    ),
  ];
}
