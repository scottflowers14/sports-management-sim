import { describe, expect, it } from 'vitest';
import { createFreshLacrosseDynasty } from './dynasty-factory';
import { createScoutingState } from './scouting';
import { emptySeasonStats } from './stats';
import {
  ACTIVE_DYNASTY_SAVE_KEY,
  DYNASTY_SAVE_INDEX_KEY,
  DYNASTY_SAVE_KEY,
  createDynastySaveId,
  dynastySaveSlotKey,
  listDynastySaves,
  loadActiveDynastySave,
  deleteDynastySave,
  saveDynastySlot,
  saveDynastyState,
  setActiveDynastySave,
  type DynastySaveState,
} from './persistence';

function makeStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
}

function makeSave(seedTime: number, userTeamId = 'maryland-state'): DynastySaveState {
  return {
    dynasty: createFreshLacrosseDynasty({ now: () => seedTime, userTeamId }),
    lastSimWeek: null,
    offseasonSummary: null,
    rankings: [],
    newsItems: [],
    tournament: null,
    dynastyHistory: [],
    injuries: [],
    scouting: createScoutingState(3),
    seasonStats: emptySeasonStats(),
    gameLogs: {},
    coachProfile: null,
    adConfidence: 60,
    seasonGoals: null,
    bestNatRank: null,
  };
}

describe('multi-save persistence', () => {
  it('saves multiple dynasty slots with metadata and loads the active slot', () => {
    const storage = makeStorage();
    const maryland = makeSave(1001, 'maryland-state');
    const virginia = makeSave(1002, 'virginia-lakes');

    saveDynastySlot({ saveId: 'save-a', name: 'Maryland Career', state: maryland, storage });
    saveDynastySlot({ saveId: 'save-b', name: 'Virginia Career', state: virginia, storage });

    const saves = listDynastySaves(storage);
    expect(saves).toHaveLength(2);
    expect(saves.map((save) => save.name)).toEqual(['Virginia Career', 'Maryland Career']);
    expect(saves[0]).toMatchObject({ saveId: 'save-b', userTeamId: 'virginia-lakes', currentWeek: 1 });
    expect(loadActiveDynastySave(storage)?.dynasty.userTeamId).toBe('virginia-lakes');

    setActiveDynastySave('save-a', storage);
    expect(loadActiveDynastySave(storage)?.dynasty.userTeamId).toBe('maryland-state');
  });

  it('migrates the old single local save into the save index', () => {
    const storage = makeStorage();
    const legacy = makeSave(2001, 'maryland-state');
    saveDynastyState(legacy, storage);

    const saves = listDynastySaves(storage);

    expect(storage.getItem(DYNASTY_SAVE_KEY)).toBeTruthy();
    expect(storage.getItem(DYNASTY_SAVE_INDEX_KEY)).toBeTruthy();
    expect(storage.getItem(ACTIVE_DYNASTY_SAVE_KEY)).toBe(saves[0]?.saveId);
    expect(storage.getItem(dynastySaveSlotKey(saves[0]?.saveId ?? 'missing'))).toBeTruthy();
    expect(loadActiveDynastySave(storage)?.dynasty.id).toBe(legacy.dynasty.id);
  });

  it('removes a save slot and clears active pointer when deleting the active save', () => {
    const storage = makeStorage();
    const maryland = makeSave(3001, 'maryland-state');
    const virginia = makeSave(3002, 'virginia-lakes');

    saveDynastySlot({ saveId: 'save-a', name: 'Maryland Career', state: maryland, storage });
    saveDynastySlot({ saveId: 'save-b', name: 'Virginia Career', state: virginia, storage });

    deleteDynastySave('save-b', storage);

    expect(listDynastySaves(storage)).toHaveLength(1);
    expect(listDynastySaves(storage)[0]?.saveId).toBe('save-a');
    expect(loadActiveDynastySave(storage)).toBeNull();
    expect(storage.getItem(dynastySaveSlotKey('save-b'))).toBeNull();
  });

  it('creates stable save IDs from seed and timestamp', () => {
    expect(createDynastySaveId(123, () => 456)).toBe('save-123-456');
  });
});
