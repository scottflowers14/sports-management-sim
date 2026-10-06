import type { DynastySeasonRecord } from './history';
import type { UnlockedAchievements } from './achievements';

/**
 * The player's profile: achievements and career totals across every dynasty
 * on this browser. It outlives saves, so deleting a dynasty keeps its record.
 */

export const PROFILE_KEY = 'sports-management-sim:profile:v1';

/** One dynasty's coaching career, overwritten from its history each season. */
export interface ProfileCareer {
  coachName: string;
  teamName: string;
  firstYear: number;
  lastYear: number;
  seasons: number;
  wins: number;
  losses: number;
  confTitles: number;
  nationalTitles: number;
  /** Best marks of this career; missing on profiles saved before they existed. */
  bests?: CareerBests;
  /** Set for Easy and Hard dynasties; Normal (and older profiles) leave it out. */
  difficulty?: 'easy' | 'hard';
}

export interface CareerBests {
  bestSeason: { year: number; wins: number; losses: number } | null;
  bestFinish: { year: number; rank: number } | null;
  biggestWin: { year: number; goalsFor: number; goalsAgainst: number } | null;
  mostGoals: { year: number; goalsFor: number; goalsAgainst: number } | null;
  longestWinStreak: number;
}

export interface PlayerProfile {
  version: 1;
  achievements: UnlockedAchievements;
  /** Careers by save id. */
  careers: Record<string, ProfileCareer>;
}

export function emptyProfile(): PlayerProfile {
  return { version: 1, achievements: {}, careers: {} };
}

function defaultStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadProfile(storage: Storage | null = defaultStorage()): PlayerProfile {
  try {
    const raw = storage?.getItem(PROFILE_KEY);
    if (!raw) return emptyProfile();
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    return { version: 1, achievements: parsed.achievements ?? {}, careers: parsed.careers ?? {} };
  } catch {
    return emptyProfile();
  }
}

/** Best effort: a full storage drops the profile write rather than the game. */
export function saveProfile(profile: PlayerProfile, storage: Storage | null = defaultStorage()): boolean {
  try {
    storage?.setItem(PROFILE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

/** Sum a dynasty's finished seasons into its career line. */
export function careerFromHistory(
  history: readonly DynastySeasonRecord[],
  coachName: string,
  difficulty: 'easy' | 'normal' | 'hard' = 'normal',
): ProfileCareer | null {
  if (history.length === 0) return null;
  const newest = history[0]!;
  const oldest = history[history.length - 1]!;
  return {
    coachName,
    teamName: newest.teamName ?? '',
    firstYear: oldest.year,
    lastYear: newest.year,
    seasons: history.length,
    wins: history.reduce((n, h) => n + h.wins, 0),
    losses: history.reduce((n, h) => n + h.losses, 0),
    confTitles: history.filter((h) => h.confChampion).length,
    nationalTitles: history.filter((h) => h.nationalChampion).length,
    bests: careerBests(history),
    ...(difficulty !== 'normal' ? { difficulty } : {}),
  };
}

/** A career's best season, finish, games and winning streak, from its history. */
export function careerBests(history: readonly DynastySeasonRecord[]): CareerBests {
  const oldestFirst = [...history].reverse();
  let bestSeason: CareerBests['bestSeason'] = null;
  let bestFinish: CareerBests['bestFinish'] = null;
  let biggestWin: CareerBests['biggestWin'] = null;
  let mostGoals: CareerBests['mostGoals'] = null;
  let streak = 0;
  let longestWinStreak = 0;
  for (const h of oldestFirst) {
    const pct = (r: { wins: number; losses: number }) => r.wins / Math.max(1, r.wins + r.losses);
    if (!bestSeason || pct(h) > pct(bestSeason) || (pct(h) === pct(bestSeason) && h.wins > bestSeason.wins)) {
      bestSeason = { year: h.year, wins: h.wins, losses: h.losses };
    }
    if (h.natRankAtEnd != null && (!bestFinish || h.natRankAtEnd < bestFinish.rank)) bestFinish = { year: h.year, rank: h.natRankAtEnd };
    for (const g of h.games ?? []) {
      const margin = g.goalsFor - g.goalsAgainst;
      if (margin > 0 && (!biggestWin || margin > biggestWin.goalsFor - biggestWin.goalsAgainst)) {
        biggestWin = { year: h.year, goalsFor: g.goalsFor, goalsAgainst: g.goalsAgainst };
      }
      if (!mostGoals || g.goalsFor > mostGoals.goalsFor) mostGoals = { year: h.year, goalsFor: g.goalsFor, goalsAgainst: g.goalsAgainst };
      streak = margin > 0 ? streak + 1 : 0;
      longestWinStreak = Math.max(longestWinStreak, streak);
    }
  }
  return { bestSeason, bestFinish, biggestWin, mostGoals, longestWinStreak };
}

export interface ProfileBest<T> {
  value: T;
  coachName: string;
  teamName: string;
}

/** The best of each mark across every career in the profile. */
export function profileBests(profile: PlayerProfile): {
  bestSeason: ProfileBest<NonNullable<CareerBests['bestSeason']>> | null;
  bestFinish: ProfileBest<NonNullable<CareerBests['bestFinish']>> | null;
  biggestWin: ProfileBest<NonNullable<CareerBests['biggestWin']>> | null;
  mostGoals: ProfileBest<NonNullable<CareerBests['mostGoals']>> | null;
  longestWinStreak: ProfileBest<number> | null;
  mostTitles: ProfileBest<number> | null;
} {
  const careers = Object.values(profile.careers);
  function best<T>(pick: (c: ProfileCareer) => T | null | undefined, better: (a: T, b: T) => boolean): ProfileBest<T> | null {
    let top: ProfileBest<T> | null = null;
    for (const c of careers) {
      const value = pick(c);
      if (value === null || value === undefined) continue;
      if (!top || better(value, top.value)) top = { value, coachName: c.coachName, teamName: c.teamName };
    }
    return top;
  }
  const pct = (r: { wins: number; losses: number }) => r.wins / Math.max(1, r.wins + r.losses);
  return {
    bestSeason: best((c) => c.bests?.bestSeason, (a, b) => pct(a) > pct(b) || (pct(a) === pct(b) && a.wins > b.wins)),
    bestFinish: best((c) => c.bests?.bestFinish, (a, b) => a.rank < b.rank),
    biggestWin: best((c) => c.bests?.biggestWin, (a, b) => a.goalsFor - a.goalsAgainst > b.goalsFor - b.goalsAgainst),
    mostGoals: best((c) => c.bests?.mostGoals, (a, b) => a.goalsFor > b.goalsFor),
    longestWinStreak: best((c) => (c.bests && c.bests.longestWinStreak > 0 ? c.bests.longestWinStreak : null), (a, b) => a > b),
    mostTitles: best((c) => (c.nationalTitles > 0 ? c.nationalTitles : null), (a, b) => a > b),
  };
}

export interface ProfileTotals {
  dynasties: number;
  seasons: number;
  wins: number;
  losses: number;
  confTitles: number;
  nationalTitles: number;
}

export function profileTotals(profile: PlayerProfile): ProfileTotals {
  const careers = Object.values(profile.careers);
  return {
    dynasties: careers.length,
    seasons: careers.reduce((n, c) => n + c.seasons, 0),
    wins: careers.reduce((n, c) => n + c.wins, 0),
    losses: careers.reduce((n, c) => n + c.losses, 0),
    confTitles: careers.reduce((n, c) => n + c.confTitles, 0),
    nationalTitles: careers.reduce((n, c) => n + c.nationalTitles, 0),
  };
}
