import { compactGameLog, normalizeGamePlan } from '@sports-management-sim/sport-lacrosse';
import { sortRecruitBoardForTeam } from '@sports-management-sim/engine-core';
import type { GameLog, LacrosseDynastyState, LacrosseGamePlan, LacrossePlayer, LacrossePortalEntry, LacrossePracticePlan, LacrosseStaff, RivalrySeriesMap, StaffMember } from '@sports-management-sim/sport-lacrosse';
import type { OffseasonSummary, InjuredPlayer, TrainingFocus } from './dynasty-helpers';
import type { PracticeLogEntry, PregameTalk } from './week-sim';
import type { LockerRoomState } from './locker-room';
import type { HallOfFameEntry, RecordBookArchive } from './records';
import type { SeasonPreview } from './preseason';
import type { RankingEntry } from './rankings';
import type { NewsItem } from './news-feed';
import type { ConferenceBracket, TournamentGame, TournamentPhase, TournamentState } from './tournament';
import type { DynastySeasonRecord } from './history';
import type { ScoutingState } from './scouting';
import { createProgramStaff, withStaffRecruitingHours } from './program-staff';
import { emptyRecruitingActivity } from './recruiting-activity';
import type { RecruitingActivity } from './recruiting-activity';
import type { SeasonStatsMap } from './stats';
import type { CareerStatsMap } from './career-stats';
import type { CoachProfile, JobOffer, SeasonGoals } from './coach-profile';
import type { WeeklyHonor } from './weekly-honors';
import type { InvestmentPlan, NilState, ProDraftPick } from '@sports-management-sim/sport-lacrosse';
import type { HalftimeState } from './halftime';
import { formatTeamName } from './ui/format';
import { decodeSave, encodeSave } from './save-codec';

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
  /** Practice intensity and individual development plans; older saves start on the staff's picks. */
  practicePlan?: LacrossePracticePlan;
  practiceGains?: PracticeLogEntry[];
  lockerRoom?: LockerRoomState;
  /** Program and league stat leaders, kept after their careers are pruned. */
  recordBook?: RecordBookArchive;
  /** Every rivalry's all-time series. */
  rivalrySeries?: RivalrySeriesMap;
  /** This season's Player of the Week honors. */
  weeklyHonors?: WeeklyHonor[];
  /** Program investments the user has funded this offseason. */
  investmentPlan?: InvestmentPlan;
  /** The media's preseason picks for the current season. */
  seasonPreview?: SeasonPreview | null;
  /** The user's program Hall of Fame, newest first. */
  hallOfFame?: HallOfFameEntry[];
  /** Every pro draft so far, all programs, newest first. */
  proDraftHistory?: ProDraftPick[];
  /** The NIL collective's money and deals for the current portal. */
  nil?: NilState | null;
  /** A coached game paused at halftime; reloading returns to the locker room. */
  halftime?: HalftimeState | null;
  /** Press conference answers by game id, recent games only. */
  pressAnswers?: Record<string, string>;
  /** This week's pregame team talk, if given. */
  teamTalk?: PregameTalk | null;
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
  /** When on, the assistant also makes its suggested scholarship offers. */
  autoRecruitingOffers?: boolean;
  /** The user's assistant coaches. Older saves get a starting staff on load. */
  staff?: LacrosseStaff;
  /** Coaches available to hire this year. */
  staffCandidates?: StaffMember[];
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
  const parsed = parsePersistedSave(decodeStored(raw));
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
  // Other programs' games keep only their scoring summary; the user's games
  // keep the full play-by-play and every stat line.
  const userGameIds = new Set(
    schedule.filter((g) => g.homeTeamId === dynasty.userTeamId || g.awayTeamId === dynasty.userTeamId).map((g) => g.id),
  );
  const gameLogs = Object.fromEntries(
    Object.entries(save.gameLogs)
      .filter(([id]) => keep.has(id))
      .map(([id, log]) => [id, userGameIds.has(id) ? log : compactGameLog(log)]),
  );
  const tournament = save.tournament ? compactTournamentLogs(save.tournament, dynasty.userTeamId) : save.tournament;
  const activeIds = new Set([
    ...dynasty.season.teams.flatMap((t) => t.roster.map((p) => p.id)),
    ...dynasty.portalEntries.map((e) => e.playerId),
  ]);
  const careerStats = Object.fromEntries(Object.entries(save.careerStats).filter(([id]) => activeIds.has(id)));
  return { ...save, dynasty: { ...dynasty, recruitBoard: [] }, gameLogs, careerStats, tournament };
}

/** Trim the play-by-play of every tournament game the user's program wasn't in. */
function compactTournamentLogs(tournament: TournamentState, userTeamId: string): TournamentState {
  const trimGame = <G extends TournamentGame | undefined>(game: G): G => {
    if (!game?.result?.log) return game;
    if (game.homeTeamId === userTeamId || game.awayTeamId === userTeamId) return game;
    return { ...game, result: { ...game.result, log: compactGameLog(game.result.log) } } as G;
  };
  const trimBracket = (bracket: ConferenceBracket): ConferenceBracket => ({
    ...bracket,
    semifinal1: trimGame(bracket.semifinal1),
    semifinal2: trimGame(bracket.semifinal2),
    ...(bracket.final ? { final: trimGame(bracket.final) } : {}),
  });
  const trimList = (games: TournamentGame[]) => games.map(trimGame);
  return {
    ...tournament,
    conferenceBrackets: tournament.conferenceBrackets.map(trimBracket),
    ...(tournament.ncaaFirstRound ? { ncaaFirstRound: trimList(tournament.ncaaFirstRound) } : {}),
    ...(tournament.ncaaQuarterfinals ? { ncaaQuarterfinals: trimList(tournament.ncaaQuarterfinals) } : {}),
    ...(tournament.nationalSemiFinal1 ? { nationalSemiFinal1: trimGame(tournament.nationalSemiFinal1) } : {}),
    ...(tournament.nationalSemiFinal2 ? { nationalSemiFinal2: trimGame(tournament.nationalSemiFinal2) } : {}),
    ...(tournament.nationalGame ? { nationalGame: trimGame(tournament.nationalGame) } : {}),
  };
}

/** Thrown by saveDynastySlot when the browser's storage has no room left. */
export class SaveStorageFullError extends Error {
  constructor() {
    super('Save failed: browser storage is full. Delete or export an old save to make room.');
    this.name = 'SaveStorageFullError';
  }
}

/** True for the quota errors browsers throw from localStorage.setItem. */
export function isStorageFullError(error: unknown): boolean {
  if (!(error instanceof Error) && !(typeof DOMException !== 'undefined' && error instanceof DOMException)) return false;
  const { name, code } = error as { name?: string; code?: number };
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014;
}

function decodeStored(raw: string): string {
  try {
    return decodeSave(raw);
  } catch {
    return '';
  }
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
  // Write the slot first: if storage is full, the index and active save stay
  // as they were and the caller hears about it.
  try {
    storage.setItem(dynastySaveSlotKey(saveId), encodeSave(JSON.stringify(compactForStorage(save))));
    upsertSaveMetadata(createSaveMetadata(state, saveId, saveName, existing?.createdAt ?? now, now), storage);
    storage.setItem(ACTIVE_DYNASTY_SAVE_KEY, saveId);
  } catch (error) {
    throw isStorageFullError(error) ? new SaveStorageFullError() : error;
  }
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
  storage.setItem(dynastySaveSlotKey(saveId), encodeSave(JSON.stringify({ ...legacy, saveId, name })));
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
  return raw === null ? null : decodeStored(raw);
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
  } catch (error) {
    if (error instanceof SaveStorageFullError) return { error: error.message };
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
    } else {
      // Entries from before the portal carried the full player record.
      parsed.dynasty = { ...parsed.dynasty, portalEntries: parsed.dynasty.portalEntries.map(upgradePortalEntry) };
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
    // Older saves carried only tempo and defense; fill in the newer axes.
    parsed.gamePlan = normalizeGamePlan(parsed.gamePlan);
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
    // Saves from before the staff system get a starting staff; the recruiting
    // coordinator now sets the weekly recruiting hours.
    if (parsed.dynasty && parsed.staff === undefined) {
      const created = createProgramStaff(parsed.dynasty);
      parsed.staff = created.staff;
      parsed.staffCandidates = created.staffCandidates;
      if (parsed.scouting) parsed.scouting = withStaffRecruitingHours(parsed.scouting, created.staff);
    }
    return parsed as PersistedDynastySave;
  } catch {
    return null;
  }
}

/** Rebuild a portal entry saved before entries carried the player, reason and eligibility. */
function upgradePortalEntry(entry: LacrossePortalEntry): LacrossePortalEntry {
  if (entry.player !== undefined && entry.reason !== undefined) return entry;
  const eligibilityByClass: Record<string, { played: number; remaining: number }> = {
    FR: { played: 0, remaining: 4 },
    SO: { played: 1, remaining: 3 },
    JR: { played: 2, remaining: 2 },
    SR: { played: 3, remaining: 1 },
    GR: { played: 4, remaining: 1 },
  };
  const elig = eligibilityByClass[entry.classYear] ?? { played: 0, remaining: 4 };
  const eligibility = entry.eligibility ?? { seasonsPlayed: elig.played, seasonsRemaining: elig.remaining, isEligible: elig.remaining > 0 };
  const player: LacrossePlayer = entry.player ?? {
    id: entry.playerId,
    name: entry.name,
    age: 20,
    classYear: entry.classYear,
    hometown: entry.regionId,
    regionId: entry.regionId,
    position: entry.position,
    secondaryPositions: [],
    ratings: entry.ratings,
    traits: [],
    sportTraits: entry.sportTraits ?? {
      shooting: 50, passing: 50, dodging: 50, stickSkills: 55, offBallMovement: 50, defense: 50, checking: 45, groundBalls: 55, preferredHand: 'right',
    },
    scholarshipPercent: 50,
    isWalkOn: false,
    morale: 50,
    health: 100,
    fatigue: 0,
    redshirtStatus: 'none',
    eligibility,
    createdSeason: 2027,
  };
  return { ...entry, player, eligibility, reason: entry.reason ?? 'playing_time', enteredSeason: entry.enteredSeason ?? 0 };
}
