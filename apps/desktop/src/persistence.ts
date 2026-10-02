import { DEFAULT_GAME_PLAN } from '@sports-management-sim/sport-lacrosse';
import { sortRecruitBoardForTeam } from '@sports-management-sim/engine-core';
import type { GameLog, LacrosseDynastyState, LacrosseGamePlan } from '@sports-management-sim/sport-lacrosse';
import type { OffseasonSummary, InjuredPlayer, TrainingFocus } from './dynasty-helpers';
import type { RankingEntry } from './rankings';
import type { NewsItem } from './news-feed';
import type { ConferenceBracket, TournamentGame, TournamentPhase, TournamentState } from './tournament';
import type { DynastySeasonRecord } from './history';
import type { ScoutingState } from './scouting';
import { RECRUITING_HOURS_PER_WEEK } from './scouting';
import { emptyRecruitingActivity } from './recruiting-activity';
import type { RecruitingActivity } from './recruiting-activity';
import type { SeasonStatsMap } from './stats';
import type { CareerStatsMap } from './career-stats';
import type { CoachProfile, JobOffer, SeasonGoals } from './coach-profile';
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
  /** Career production by player id, accumulated across completed seasons. */
  careerStats: CareerStatsMap;
  /** Keyed by game ID. Maps don't JSON-serialize so stored as a plain Record. */
  gameLogs: Record<string, GameLog>;
  coachProfile: CoachProfile | null;
  adConfidence: number;
  seasonGoals: SeasonGoals | null;
  /** Best national rank achieved this season (lowest number = best). */
  bestNatRank: number | null;
  gamePlan: LacrosseGamePlan;
  trainingFocus: TrainingFocus;
  /** Job offers awaiting a decision after the coach was fired, null otherwise. */
  pendingJobOffers: JobOffer[] | null;
  /** Recruit IDs the user has pinned to their recruiting board. */
  shortlistIds: string[];
  /** Pending pitches and visit invites for the current week. */
  recruitingActivity: RecruitingActivity;
  /** Change in user interest per recruit over the last simulated week. */
  recruitTrends: Record<string, number>;
  /** When on, the recruiting assistant spends leftover hours before each simulated week. */
  autoRecruitingAssistant?: boolean;
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

/**
 * Drop what can be rebuilt or isn't worth the space before writing to
 * localStorage (about 5 MB per site, shared by every save slot):
 * - the recruit board embeds a copy of every recruit; it's rebuilt on load.
 * - play-by-play for CPU-vs-CPU regular-season games, except the latest week.
 *   Their box scores stay on the schedule; only the play-by-play goes.
 * - play-by-play from past seasons.
 * - career stats for players who have left the league (graduated or gone);
 *   only current players and portal entries have a card that shows them.
 */
export function compactForStorage<T extends DynastySaveState>(save: T): T {
  const { dynasty } = save;
  const { schedule } = dynasty.season;
  const latestWeek = schedule.reduce((max, g) => (g.status === 'final' ? Math.max(max, g.week) : max), 0);
  const keep = new Set(
    schedule
      .filter(
        (g) =>
          g.homeTeamId === dynasty.userTeamId ||
          g.awayTeamId === dynasty.userTeamId ||
          g.week === latestWeek,
      )
      .map((g) => g.id),
  );
  // Logs from past seasons aren't reachable from any screen, so they go too.
  const gameLogs = Object.fromEntries(Object.entries(save.gameLogs).filter(([id]) => keep.has(id)));
  const activeIds = new Set([
    ...dynasty.season.teams.flatMap((t) => t.roster.map((p) => p.id)),
    ...dynasty.portalEntries.map((e) => e.playerId),
  ]);
  const careerStats = Object.fromEntries(Object.entries(save.careerStats).filter(([id]) => activeIds.has(id)));
  return { ...save, dynasty: { ...dynasty, recruitBoard: [] }, gameLogs, careerStats };
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
  storage.setItem(dynastySaveSlotKey(saveId), JSON.stringify(compactForStorage(save)));
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

export function exportSaveAsJson(saveId: string, storage: Storage = window.localStorage): string | null {
  const raw = storage.getItem(dynastySaveSlotKey(saveId));
  return raw ?? null;
}

export function importSaveFromJson(
  json: string,
  storage: Storage = window.localStorage,
): { saveId: string } | { error: string } {
  try {
    const parsed = parsePersistedSave(json);
    if (!parsed) return { error: 'Invalid or incompatible save file.' };
    const saveId = (parsed as PersistedDynastySave & { saveId?: string }).saveId
      ?? createDynastySaveId(parsed.dynasty.seed);
    const name = (parsed as PersistedDynastySave & { name?: string }).name
      ?? defaultSaveName(parsed.dynasty);
    saveDynastySlot({ saveId, name, state: parsed, storage });
    return { saveId };
  } catch {
    return { error: 'Failed to parse save file.' };
  }
}

function parsePersistedSave(raw: string): PersistedDynastySave | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedDynastySave>;
    if (parsed.version !== DYNASTY_SAVE_VERSION || !parsed.dynasty) {
      return null;
    }
    // Migrate old 2-bracket tournament format { accBracket, necBracket, ... } to new shape.
    if (parsed.tournament && !('conferenceBrackets' in parsed.tournament)) {
      const old = parsed.tournament as Record<string, unknown>;
      const conferenceBrackets: ConferenceBracket[] = [];
      if (old['accBracket']) conferenceBrackets.push(old['accBracket'] as ConferenceBracket);
      if (old['necBracket']) conferenceBrackets.push(old['necBracket'] as ConferenceBracket);
      const phaseMap: Record<string, TournamentPhase> = {
        semis: 'conf_semis',
        finals: 'conf_finals',
        national: 'national_final',
        complete: 'complete',
      };
      const phase: TournamentPhase = phaseMap[old['phase'] as string] ?? 'conf_semis';
      parsed.tournament = {
        phase,
        conferenceBrackets,
        ...(old['nationalGame'] ? { nationalGame: old['nationalGame'] as TournamentGame } : {}),
        ...(old['nationalChampion'] ? { nationalChampion: old['nationalChampion'] as string } : {}),
      };
    }
    if (!parsed.dynasty.portalEntries) {
      parsed.dynasty = { ...parsed.dynasty, portalEntries: [] };
    }
    if (!parsed.gameLogs) {
      parsed.gameLogs = {};
    }
    if (parsed.coachProfile === undefined) {
      parsed.coachProfile = null;
    }
    if (parsed.adConfidence === undefined) {
      parsed.adConfidence = 60;
    }
    if (parsed.seasonGoals === undefined) {
      parsed.seasonGoals = null;
    }
    if (parsed.bestNatRank === undefined) {
      parsed.bestNatRank = null;
    }
    if (parsed.gamePlan === undefined) {
      parsed.gamePlan = DEFAULT_GAME_PLAN;
    }
    if (parsed.trainingFocus === undefined) {
      parsed.trainingFocus = 'balanced';
    }
    if (parsed.pendingJobOffers === undefined) {
      parsed.pendingJobOffers = null;
    }
    if (parsed.shortlistIds === undefined) {
      parsed.shortlistIds = [];
    }
    if (parsed.careerStats === undefined) {
      parsed.careerStats = {};
    }
    if (parsed.recruitingActivity === undefined) {
      parsed.recruitingActivity = emptyRecruitingActivity();
    }
    if (parsed.recruitTrends === undefined) {
      parsed.recruitTrends = {};
    }
    // Compacted saves store an empty recruit board; rebuild it from the recruits.
    const dynasty = parsed.dynasty;
    if (dynasty && dynasty.recruitBoard.length === 0 && dynasty.recruits.length > 0) {
      const userTeam = dynasty.season.teams.find((t) => t.id === dynasty.userTeamId);
      if (userTeam) {
        parsed.dynasty = {
          ...dynasty,
          recruitBoard: sortRecruitBoardForTeam(userTeam, dynasty.recruits, dynasty.rosterTargets),
        };
      }
    }
    // Older saves banked 3 scouting points a week; the unified recruiting-hours
    // pool pays for pitches and visits too, so bring them up to the new rate.
    if (parsed.scouting && parsed.scouting.pointsPerWeek < RECRUITING_HOURS_PER_WEEK) {
      parsed.scouting = { ...parsed.scouting, pointsPerWeek: RECRUITING_HOURS_PER_WEEK };
    }
    return parsed as PersistedDynastySave;
  } catch {
    return null;
  }
}
