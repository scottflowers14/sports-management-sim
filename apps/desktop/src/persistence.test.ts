import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_PLAN, recruitingHoursFor, STAFF_ROLES } from '@sports-management-sim/sport-lacrosse';
import { createFreshLacrosseDynasty } from './dynasty-factory';
import { createScoutingState } from './scouting';
import { emptyRecruitingActivity } from './recruiting-activity';
import { emptySeasonStats } from './stats';
import { simulateRemainingWeeks } from './week-sim';
import {
  ACTIVE_DYNASTY_SAVE_KEY,
  DYNASTY_SAVE_INDEX_KEY,
  DYNASTY_SAVE_KEY,
  createDynastySaveId,
  dynastySaveSlotKey,
  listDynastySaves,
  loadActiveDynastySave,
  loadDynastySaveSlot,
  compactForStorage,
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
    scouting: createScoutingState(),
    seasonStats: emptySeasonStats(),
    careerStats: {},
    gameLogs: {},
    coachProfile: null,
    adConfidence: 60,
    seasonGoals: null,
    bestNatRank: null,
    gamePlan: DEFAULT_GAME_PLAN,
    trainingFocus: 'balanced',
    pendingJobOffers: null,
    shortlistIds: [],
    recruitingActivity: emptyRecruitingActivity(),
    recruitTrends: {},
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

  it('migrates saves that predate recruiting hours and weekly recruiting actions', () => {
    const storage = makeStorage();
    const save = makeSave(4001);
    const legacy: Record<string, unknown> = {
      version: 1,
      savedAt: new Date().toISOString(),
      ...save,
      scouting: { partialIds: {}, fullIds: [], pointsAvailable: 2, pointsPerWeek: 3 },
    };
    delete legacy['recruitingActivity'];
    delete legacy['recruitTrends'];
    storage.setItem(dynastySaveSlotKey('save-legacy'), JSON.stringify(legacy));

    const loaded = loadDynastySaveSlot('save-legacy', storage);

    expect(loaded).not.toBeNull();
    expect(loaded!.recruitingActivity).toEqual({ visitIds: [], pitchedIds: [] });
    expect(loaded!.recruitTrends).toEqual({});
    // Pre-staff saves get a full starting staff, and the recruiting
    // coordinator sets the weekly hours.
    for (const role of STAFF_ROLES) expect(loaded!.staff?.[role]?.role).toBe(role);
    expect(loaded!.staffCandidates!.length).toBeGreaterThan(0);
    expect(loaded!.scouting.pointsPerWeek).toBe(recruitingHoursFor(loaded!.staff!.recruiting!.rating));
    expect(loaded!.scouting.pointsAvailable).toBe(2);
  });

  it('fills in the ride and rotation of a game plan saved before they existed', () => {
    const storage = makeStorage();
    const save = makeSave(4002);
    const legacy: Record<string, unknown> = {
      version: 1,
      savedAt: new Date().toISOString(),
      ...save,
      gamePlan: { tempo: 'uptempo', defense: 'shell' },
    };
    storage.setItem(dynastySaveSlotKey('save-plan'), JSON.stringify(legacy));

    const loaded = loadDynastySaveSlot('save-plan', storage);
    expect(loaded!.gamePlan).toEqual({ tempo: 'uptempo', defense: 'shell', ride: 'standard', rotation: 'balanced' });
  });
});

describe('save compaction', () => {
  function playedSave(): DynastySaveState {
    const base = makeSave(2001);
    const played = simulateRemainingWeeks({
      dynasty: base.dynasty,
      rankings: [],
      injuries: [],
      newsItems: [],
      scouting: base.scouting,
      recruitingActivity: base.recruitingActivity,
      recruitTrends: {},
      seasonStats: base.seasonStats,
      gameLogs: new Map(),
      bestNatRank: null,
      lastSimWeek: null,
    });
    return { ...base, dynasty: played.dynasty, gameLogs: Object.fromEntries(played.gameLogs) };
  }

  it('keeps play-by-play for the user and the latest week only', () => {
    const save = playedSave();
    const compact = compactForStorage(save);
    const { schedule } = save.dynasty.season;
    const latestWeek = Math.max(...schedule.map((g) => g.week));
    const user = save.dynasty.userTeamId;
    for (const game of schedule) {
      const keep = game.homeTeamId === user || game.awayTeamId === user || game.week === latestWeek;
      expect(game.id in compact.gameLogs).toBe(keep);
    }
    expect(compact.dynasty.recruitBoard).toEqual([]);
    // Logs from an earlier season (ids not on this schedule) are dropped.
    expect('2027-week-1-old-vs-older' in compactForStorage({ ...save, gameLogs: { ...save.gameLogs, '2027-week-1-old-vs-older': save.gameLogs[schedule[0]!.id]! } }).gameLogs).toBe(false);
    // Box scores survive on the schedule.
    expect(compact.dynasty.season.schedule.every((g) => g.result !== undefined)).toBe(true);
  });

  it('keeps every possession for the user and only the scoring summary for other programs', () => {
    const save = playedSave();
    const compact = compactForStorage(save);
    const user = save.dynasty.userTeamId;
    for (const [id, log] of Object.entries(compact.gameLogs)) {
      const game = save.dynasty.season.schedule.find((g) => g.id === id)!;
      const isUserGame = game.homeTeamId === user || game.awayTeamId === user;
      const nonScoring = log.events.filter((e) => e.type !== 'goal' && e.type !== 'period_end');
      if (isUserGame) {
        expect(nonScoring.length).toBeGreaterThan(0);
        expect(log.playerLines!.length).toBeGreaterThan(0);
      } else {
        expect(nonScoring).toEqual([]);
        expect(log.playerLines).toBeUndefined();
        // The goals and the running score survive.
        expect(log.events.filter((e) => e.type === 'goal').length).toBe(game.result!.homeScore + game.result!.awayScore);
      }
    }
  });

  it('keeps career stats only for players still in the league', () => {
    const save = playedSave();
    const current = save.dynasty.season.teams[0]!.roster[0]!.id;
    const line = { seasons: [], totals: {} } as unknown as DynastySaveState['careerStats'][string];
    const compact = compactForStorage({ ...save, careerStats: { [current]: line, 'graduated-player': line } });
    expect(Object.keys(compact.careerStats)).toEqual([current]);
  });

  it('rebuilds the recruit board on load and shrinks the save', () => {
    const storage = makeStorage();
    const save = playedSave();
    saveDynastySlot({ saveId: 'save-c', state: save, storage });
    const stored = storage.getItem(dynastySaveSlotKey('save-c'))!;
    expect(stored.length).toBeLessThan(JSON.stringify(save).length * 0.75);

    const loaded = loadDynastySaveSlot('save-c', storage)!;
    expect(loaded.dynasty.recruitBoard.map((e) => e.recruit.id)).toEqual(save.dynasty.recruitBoard.map((e) => e.recruit.id));
  });
});
