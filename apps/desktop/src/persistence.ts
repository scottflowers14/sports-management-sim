import type { LacrosseDynastyState } from '@sports-management-sim/sport-lacrosse';
import type { OffseasonSummary, InjuredPlayer } from './dynasty-helpers';
import type { RankingEntry } from './rankings';
import type { NewsItem } from './news-feed';
import type { TournamentState } from './tournament';
import type { DynastySeasonRecord } from './history';
import type { ScoutingState } from './scouting';
import type { SeasonStatsMap } from './stats';

export const DYNASTY_SAVE_VERSION = 1;
export const DYNASTY_SAVE_KEY = 'sports-management-sim:dynasty-save:v1';

export interface DynastySaveState {
  dynasty: LacrosseDynastyState;
  lastSimWeek: number | null;
  offseasonSummary: OffseasonSummary | null;
  rankings: RankingEntry[];
  newsItems: NewsItem[];
  tournament: TournamentState | null;
  dynastyHistory: DynastySeasonRecord[];
  injuries: InjuredPlayer[];
  scouting: ScoutingState;
  seasonStats: SeasonStatsMap;
}

interface PersistedDynastySave extends DynastySaveState {
  version: typeof DYNASTY_SAVE_VERSION;
  savedAt: string;
}

export function saveDynastyState(state: DynastySaveState, storage: Storage = window.localStorage): PersistedDynastySave {
  const save: PersistedDynastySave = {
    version: DYNASTY_SAVE_VERSION,
    savedAt: new Date().toISOString(),
    ...state,
  };
  storage.setItem(DYNASTY_SAVE_KEY, JSON.stringify(save));
  return save;
}

export function loadDynastyState(storage: Storage = window.localStorage): PersistedDynastySave | null {
  const raw = storage.getItem(DYNASTY_SAVE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedDynastySave>;
    if (parsed.version !== DYNASTY_SAVE_VERSION || !parsed.dynasty) {
      return null;
    }
    // Hydrate fields added after the initial save version so old saves don't crash
    if (!parsed.dynasty.portalEntries) {
      parsed.dynasty = { ...parsed.dynasty, portalEntries: [] };
    }
    return parsed as PersistedDynastySave;
  } catch {
    return null;
  }
}

export function clearDynastyState(storage: Storage = window.localStorage): void {
  storage.removeItem(DYNASTY_SAVE_KEY);
}
