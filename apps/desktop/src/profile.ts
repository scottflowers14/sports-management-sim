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
export function careerFromHistory(history: readonly DynastySeasonRecord[], coachName: string): ProfileCareer | null {
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
