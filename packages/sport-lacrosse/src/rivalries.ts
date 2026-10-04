import type { Conference, ScheduledGame } from '@sports-management-sim/engine-core';
import type { LacrosseTeam } from './models';

export interface Rivalry {
  /** Stable key: the two team ids, sorted, joined by '|'. */
  key: string;
  teamIds: [string, string];
  trophy: string;
}

export interface RivalrySeries {
  /** Wins by team id. */
  wins: Record<string, number>;
  /** Who holds the trophy: the last winner. */
  holderId: string | null;
  /** The last few meetings, newest first. */
  recent: { year: number; winnerId: string; score: string }[];
}

export type RivalrySeriesMap = Record<string, RivalrySeries>;

const TROPHY_METALS = ['Iron', 'Bronze', 'Silver', 'Golden', 'Copper', 'Old', 'Brass', 'Granite'];
const TROPHY_OBJECTS = ['Stick', 'Crosse', 'Pole', 'Helmet', 'Net', 'Crease', 'Lantern', 'Shield', 'Anvil', 'Bell'];
const MAX_RECENT = 5;

export function rivalryKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
}

const TROPHY_COUNT = TROPHY_METALS.length * TROPHY_OBJECTS.length;

function trophyName(index: number): string {
  return `The ${TROPHY_METALS[index % TROPHY_METALS.length]} ${TROPHY_OBJECTS[Math.floor(index / TROPHY_METALS.length) % TROPHY_OBJECTS.length]}`;
}

/** A trophy picked from the pair's ids, moving on past any already taken. */
function trophyFor(key: string, taken: Set<string>): string {
  const start = hash(key) % TROPHY_COUNT;
  for (let step = 0; step < TROPHY_COUNT; step += 1) {
    const name = trophyName((start + step * 7) % TROPHY_COUNT);
    if (!taken.has(name)) return name;
  }
  return trophyName(start);
}

/**
 * Each program's rival is a conference opponent, a neighbor in its region when
 * there is one, so the two always meet in the conference round-robin. The
 * pairings are the same every season. A team left over in an odd-sized
 * conference has no rival.
 */
export function buildRivalries(conferences: readonly Conference[], teams: readonly LacrosseTeam[]): Rivalry[] {
  const regionOf = new Map(teams.map((t) => [t.id, t.regionId]));
  const rivalries: Rivalry[] = [];
  const taken = new Set<string>();
  for (const conference of conferences) {
    const unpaired = [...conference.teamIds].sort();
    while (unpaired.length >= 2) {
      const first = unpaired.shift()!;
      const neighbor = unpaired.findIndex((id) => regionOf.get(id) === regionOf.get(first));
      const [partner] = unpaired.splice(neighbor === -1 ? 0 : neighbor, 1);
      const key = rivalryKey(first, partner!);
      const trophy = trophyFor(key, taken);
      taken.add(trophy);
      rivalries.push({ key, teamIds: [first, partner!], trophy });
    }
  }
  return rivalries;
}

export function rivalryFor(rivalries: readonly Rivalry[], teamId: string): Rivalry | null {
  return rivalries.find((r) => r.teamIds.includes(teamId)) ?? null;
}

export function rivalryForGame(rivalries: readonly Rivalry[], game: Pick<ScheduledGame, 'homeTeamId' | 'awayTeamId'>): Rivalry | null {
  const key = rivalryKey(game.homeTeamId, game.awayTeamId);
  return rivalries.find((r) => r.key === key) ?? null;
}

/** Record a finished rivalry game in the series. */
export function recordRivalryGame(series: RivalrySeriesMap, rivalry: Rivalry, game: ScheduledGame, year: number): RivalrySeriesMap {
  const result = game.result;
  if (!result) return series;
  const current = series[rivalry.key] ?? { wins: {}, holderId: null, recent: [] };
  const winnerId = result.winnerTeamId;
  const high = Math.max(result.homeScore, result.awayScore);
  const low = Math.min(result.homeScore, result.awayScore);
  return {
    ...series,
    [rivalry.key]: {
      wins: { ...current.wins, [winnerId]: (current.wins[winnerId] ?? 0) + 1 },
      holderId: winnerId,
      recent: [{ year, winnerId, score: `${high}-${low}` }, ...current.recent].slice(0, MAX_RECENT),
    },
  };
}

/** "Leads 3-1", "Trails 1-2", "Tied 2-2", or "First meeting". */
export function seriesSummary(series: RivalrySeries | undefined, teamId: string, rivalId: string): string {
  const mine = series?.wins[teamId] ?? 0;
  const theirs = series?.wins[rivalId] ?? 0;
  if (mine + theirs === 0) return 'First meeting';
  if (mine === theirs) return `Series tied ${mine}-${theirs}`;
  return `${mine > theirs ? 'Leads' : 'Trails'} the series ${mine}-${theirs}`;
}
