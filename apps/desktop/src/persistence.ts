import type { GameLog, LacrosseDynastyState } from '@sports-management-sim/sport-lacrosse';
import type { OffseasonSummary, InjuredPlayer } from './dynasty-helpers';
import type { RankingEntry } from './rankings';
import type { NewsItem } from './news-feed';
import type { TournamentState } from './tournament';
import type { DynastySeasonRecord } from './history';
import type { ScoutingState } from './scouting';
import type { SeasonStatsMap } from './stats';
import { formatTeamName } from './ui/format';

export const DYNASTY_SAVE_VERSION = 1;
export const DYNASTY_SAVE_KEY = 'sports-management-sim:dynasty-save:v1';
export const DYNASTY_SAVE_INDEX_KEY = 'sports-management-sim:saves:v1:index';
export const ACTIVE_DYNASTY_SAVE_KEY = 'sports-management-sim:saves:v1:active';
export const DYNASTY_SAVE_SLOT_PREFIX = 'sports-management-sim:saves:v1:';

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
  /** Keyed by game ID. Maps don't JSON-serialize so stored as a plain Record. */
  gameLogs: Record<string, GameLog>;
}

export interface DynastySaveMetadata {
  saveId: string;
  dynastyId: string;
  name: string;
  userTeamId: string;
  userTeamName: string;
  seasonYear: number;
  currentWeek: number;
  record: { wins: number; losses: number };
  seed: number;
  createdAt: string;
  updatedAt: string;
}

export interface DynastySaveIndex {
  version: typeof DYNASTY_SAVE_VERSION;
  saves: DynastySaveMetadata[];
}

export interface PersistedDynastySave extends DynastySaveState {
  version: typeof DYNASTY_SAVE_VERSION;
  savedAt: string;
  saveId?: string;
  name?: string;
}

export function dynastySaveSlotKey(saveId: string): string {
  return `${DYNASTY_SAVE_SLOT_PREFIX}${saveId}`;
}

export function createDynastySaveId(seed: number, now: () => number = Date.now): string {
  return `save-${seed}-${Math.max(1, Math.floor(now()))}`;
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
  return parsePersistedSave(raw);
}

export function clearDynastyState(storage: Storage = window.localStorage): void {
  storage.removeItem(DYNASTY_SAVE_KEY);
}

export function listDynastySaves(storage: Storage = window.localStorage): DynastySaveMetadata[] {
  migrateLegacyDynastySave(storage);
  return readIndex(storage).saves;
}

export function loadActiveDynastySave(storage: Storage = window.localStorage): PersistedDynastySave | null {
  migrateLegacyDynastySave(storage);
  const activeSaveId = storage.getItem(ACTIVE_DYNASTY_SAVE_KEY);
  if (!activeSaveId) return null;
  return loadDynastySaveSlot(activeSaveId, storage);
}

export function loadDynastySaveSlot(saveId: string, storage: Storage = window.localStorage): PersistedDynastySave | null {
  const raw = storage.getItem(dynastySaveSlotKey(saveId));
  if (!raw) return null;
  const parsed = parsePersistedSave(raw);
  return parsed ? { ...parsed, saveId } : null;
}

export function getActiveDynastySaveId(storage: Storage = window.localStorage): string | null {
  migrateLegacyDynastySave(storage);
  return storage.getItem(ACTIVE_DYNASTY_SAVE_KEY);
}

export function setActiveDynastySave(saveId: string, storage: Storage = window.localStorage): void {
  storage.setItem(ACTIVE_DYNASTY_SAVE_KEY, saveId);
}

export function saveDynastySlot({
  saveId,
  name,
  state,
  storage = window.localStorage,
}: {
  saveId: string;
  name?: string;
  state: DynastySaveState;
  storage?: Storage;
}): PersistedDynastySave {
  const now = new Date().toISOString();
  const existing = readIndex(storage).saves.find((save) => save.saveId === saveId);
  const saveName = name ?? existing?.name ?? defaultSaveName(state.dynasty);
  const save: PersistedDynastySave = {
    version: DYNASTY_SAVE_VERSION,
    savedAt: now,
    saveId,
    name: saveName,
    ...state,
  };
  storage.setItem(dynastySaveSlotKey(saveId), JSON.stringify(save));
  upsertSaveMetadata(createSaveMetadata(state, saveId, saveName, existing?.createdAt ?? now, now), storage);
  storage.setItem(ACTIVE_DYNASTY_SAVE_KEY, saveId);
  return save;
}

export function deleteDynastySave(saveId: string, storage: Storage = window.localStorage): void {
  storage.removeItem(dynastySaveSlotKey(saveId));
  writeIndex({ version: DYNASTY_SAVE_VERSION, saves: readIndex(storage).saves.filter((save) => save.saveId !== saveId) }, storage);
  if (storage.getItem(ACTIVE_DYNASTY_SAVE_KEY) === saveId) {
    storage.removeItem(ACTIVE_DYNASTY_SAVE_KEY);
  }
}

function migrateLegacyDynastySave(storage: Storage): void {
  if (storage.getItem(DYNASTY_SAVE_INDEX_KEY)) return;
  const legacy = loadDynastyState(storage);
  if (!legacy) {
    writeIndex({ version: DYNASTY_SAVE_VERSION, saves: [] }, storage);
    return;
  }
  const saveId = createDynastySaveId(legacy.dynasty.seed, () => new Date(legacy.savedAt).getTime());
  const name = defaultSaveName(legacy.dynasty);
  const savedAt = legacy.savedAt;
  storage.setItem(dynastySaveSlotKey(saveId), JSON.stringify({ ...legacy, saveId, name }));
  writeIndex(
    {
      version: DYNASTY_SAVE_VERSION,
      saves: [createSaveMetadata(legacy, saveId, name, savedAt, savedAt)],
    },
    storage,
  );
  storage.setItem(ACTIVE_DYNASTY_SAVE_KEY, saveId);
}

function readIndex(storage: Storage): DynastySaveIndex {
  const raw = storage.getItem(DYNASTY_SAVE_INDEX_KEY);
  if (!raw) return { version: DYNASTY_SAVE_VERSION, saves: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<DynastySaveIndex>;
    if (parsed.version !== DYNASTY_SAVE_VERSION || !Array.isArray(parsed.saves)) {
      return { version: DYNASTY_SAVE_VERSION, saves: [] };
    }
    return { version: DYNASTY_SAVE_VERSION, saves: parsed.saves };
  } catch {
    return { version: DYNASTY_SAVE_VERSION, saves: [] };
  }
}

function writeIndex(index: DynastySaveIndex, storage: Storage): void {
  storage.setItem(DYNASTY_SAVE_INDEX_KEY, JSON.stringify(index));
}

function upsertSaveMetadata(metadata: DynastySaveMetadata, storage: Storage): void {
  const index = readIndex(storage);
  const saves = [metadata, ...index.saves.filter((save) => save.saveId !== metadata.saveId)].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  writeIndex({ version: DYNASTY_SAVE_VERSION, saves }, storage);
}

function createSaveMetadata(
  state: DynastySaveState,
  saveId: string,
  name: string,
  createdAt: string,
  updatedAt: string,
): DynastySaveMetadata {
  const userTeam = state.dynasty.season.teams.find((team) => team.id === state.dynasty.userTeamId);
  return {
    saveId,
    dynastyId: state.dynasty.id,
    name,
    userTeamId: state.dynasty.userTeamId,
    userTeamName: userTeam ? formatTeamName(userTeam.name) : state.dynasty.userTeamId,
    seasonYear: state.dynasty.season.year,
    currentWeek: state.dynasty.season.currentWeek,
    record: userTeam?.record ?? { wins: 0, losses: 0 },
    seed: state.dynasty.seed,
    createdAt,
    updatedAt,
  };
}

function defaultSaveName(dynasty: LacrosseDynastyState): string {
  const userTeam = dynasty.season.teams.find((team) => team.id === dynasty.userTeamId);
  return `${userTeam ? formatTeamName(userTeam.name) : dynasty.userTeamId} ${dynasty.season.year}`;
}

function parsePersistedSave(raw: string): PersistedDynastySave | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedDynastySave>;
    if (parsed.version !== DYNASTY_SAVE_VERSION || !parsed.dynasty) {
      return null;
    }
    if (!parsed.dynasty.portalEntries) {
      parsed.dynasty = { ...parsed.dynasty, portalEntries: [] };
    }
    if (!parsed.gameLogs) {
      parsed.gameLogs = {};
    }
    return parsed as PersistedDynastySave;
  } catch {
    return null;
  }
}
