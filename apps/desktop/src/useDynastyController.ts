import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  applyRecruitPitch,
  applyScholarshipOffer,
  classScholarshipBudgetUsed,
  recruitPrestigeMultiplier,
  sortRecruitBoardForTeam,
} from '@sports-management-sim/engine-core';
import type { RecruitMotivation } from '@sports-management-sim/engine-core';
import {
  DEFAULT_GAME_PLAN,
  LACROSSE_CLASS_SCHOLARSHIP_BUDGET,
  deriveCpuGamePlan,
  normalizeGamePlan,
  fillStaffVacancies,
  hireStaffCandidate,
  offerLacrossePortalPlayer,
  withdrawLacrossePortalOffer,
  programCoachingEdge,
  releaseStaffMember,
  runStaffOffseason,
  staffBudgetFor,
  STAFF_ROLE_LABELS,
  updateLacrosseDepthChartSlot,
} from '@sports-management-sim/sport-lacrosse';
import type { StaffRole } from '@sports-management-sim/sport-lacrosse';
import {
  autoDevelopmentPlans,
  boostMorale,
  setCaptain,
  setLacrosseRedshirt,
  MAX_DEVELOPMENT_PLANS,
  PLAYER_TALK_BOOST,
  TEAM_MEETING_BOOST,
  TEAM_MEETING_COOLDOWN,
  prunePracticePlan,
  type DevelopmentFocusArea,
  type LacrossePracticePlan,
  type PracticeIntensity,
} from '@sports-management-sim/sport-lacrosse';
import { createProgramStaff, withStaffRecruitingHours } from './program-staff';
import type { ProgramStaffState } from './program-staff';
import type { GameLog, LacrosseDynastyState, LacrosseGamePlan, LacrossePosition, LacrosseTeam } from '@sports-management-sim/sport-lacrosse';
import { healInjuriesOneWeek, runOffseason, resolveAndApplyPortal, portalScholarshipRoom } from './dynasty-helpers';
import type { OffseasonSummary, InjuredPlayer, TrainingFocus } from './dynasty-helpers';
import { simulateOneWeek, simulateRemainingWeeks, withoutUnavailable } from './week-sim';
import { computeNationalRankings } from './rankings';
import { applyAssistantToWeekState, summarizeAssistantActions, type AssistantReport } from './recruiting-assistant';
import type { PracticeLogEntry, WeekSimState } from './week-sim';
import { EMPTY_LOCKER_ROOM, type LockerRoomState } from './locker-room';
import { archiveRecords, recordNewsForWeek, type RecordBookArchive } from './records';
import {
  createCoachProfile,
  generateCoachName,
  generateSeasonGoals,
  evaluateSeasonGoals,
  updateADConfidence,
  advanceCoachTenure,
  shouldFireCoach,
  generateJobOffers,
} from './coach-profile';
import type { CoachProfile, JobOffer, SeasonGoals } from './coach-profile';
import type { RankingEntry } from './rankings';
import type { NewsItem } from './news-feed';
import { portalMoveNews } from './news-feed';
import {
  initTournament,
  advanceTournamentSemis,
  advanceNcaaFirstRound,
  advanceNcaaQuarterfinals,
  advanceTournamentFinals,
  advanceTournamentNationalSemis,
  advanceNationalChampionship,
  compareConferenceStanding,
} from './tournament';
import type { TournamentState } from './tournament';
import type { DynastySeasonRecord } from './history';
import { deriveSeasonLeader, toSeasonAwardRecords } from './history';
import {
  createScoutingState,
  scoutRecruit as scoutRecruitFn,
  resetScoutingForNewClass,
  spendRecruitingHours,
  HOURS_COST,
} from './scouting';
import type { ScoutingState } from './scouting';
import { emptyRecruitingActivity } from './recruiting-activity';
import type { RecruitingActivity } from './recruiting-activity';
import { emptySeasonStats } from './stats';
import type { SeasonStatsMap } from './stats';
import { emptyCareerStats, recordSeasonToCareer } from './career-stats';
import type { CareerStatsMap } from './career-stats';
import type { BoxScoreData } from './ui/types';
import { formatTeamName } from './ui/format';
import {
  ACTIVE_DYNASTY_SAVE_KEY,
  createDynastySaveId,
  deleteDynastySave,
  exportSaveAsJson,
  getActiveDynastySaveId,
  importSaveFromJson,
  listDynastySaves,
  loadActiveDynastySave,
  loadDynastySaveSlot,
  saveDynastySlot,
  type DynastySaveMetadata,
  type DynastySaveState,
} from './persistence';
import {
  clearCustomTeamsConfig,
  createFreshLacrosseDynasty,
  exportDefaultTeamsConfigJson,
  getLacrosseDynastyTeamChoices,
  loadCustomTeamsConfig,
  parseAndValidateCustomTeamsJson,
  saveCustomTeamsConfig,
} from './dynasty-factory';
import type { CustomTeamsFile } from '@sports-management-sim/sport-lacrosse';

export type View =
  | 'week-hub'
  | 'season'
  | 'team'
  | 'schedule'
  | 'recruiting'
  | 'standings'
  | 'records'
  | 'offseason'
  | 'news'
  | 'tournament'
  | 'history'
  | 'stats'
  | 'programs'
  | 'players'
  | 'staff'
  | 'practice'
  | 'locker-room';

export function useDynastyController() {
  const [screen, setScreen] = useState<'start' | 'game'>('start');
  const [loadedSave] = useState(() => loadActiveDynastySave());
  const [activeSaveId, setActiveSaveId] = useState<string | null>(() => getActiveDynastySaveId());
  const [saves, setSaves] = useState<DynastySaveMetadata[]>(() => listDynastySaves());
  const [customTeams, setCustomTeams] = useState<CustomTeamsFile | null>(() => loadCustomTeamsConfig());
  const teamChoices = useMemo(() => getLacrosseDynastyTeamChoices(customTeams ?? undefined), [customTeams]);
  const [selectedNewTeamId, setSelectedNewTeamId] = useState(() => teamChoices[0]?.id ?? 'maryland-state');
  const [dynasty, setDynasty] = useState<LacrosseDynastyState>(() => loadedSave?.dynasty ?? createFreshLacrosseDynasty());
  // A save made mid-offseason must reopen there: the new season isn't ready until Start Season.
  const [view, setView] = useState<View>(() => (loadedSave?.offseasonSummary ? 'offseason' : 'week-hub'));
  const [lastSimWeek, setLastSimWeek] = useState<number | null>(loadedSave?.lastSimWeek ?? null);
  const [offseasonSummary, setOffseasonSummary] = useState<OffseasonSummary | null>(loadedSave?.offseasonSummary ?? null);
  const [rankings, setRankings] = useState<RankingEntry[]>(loadedSave?.rankings ?? []);
  const [newsItems, setNewsItems] = useState<NewsItem[]>(loadedSave?.newsItems ?? []);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedRecruitId, setSelectedRecruitId] = useState<string | null>(null);
  const [tournament, setTournament] = useState<TournamentState | null>(loadedSave?.tournament ?? null);
  const [dynastyHistory, setDynastyHistory] = useState<DynastySeasonRecord[]>(loadedSave?.dynastyHistory ?? []);
  const [injuries, setInjuries] = useState<InjuredPlayer[]>(loadedSave?.injuries ?? []);
  const [selectedBoxScore, setSelectedBoxScore] = useState<BoxScoreData | null>(null);
  const [gameLogs, setGameLogs] = useState<Map<string, GameLog>>(() =>
    new Map(Object.entries(loadedSave?.gameLogs ?? {})),
  );
  const [scouting, setScouting] = useState<ScoutingState>(() => loadedSave?.scouting ?? createScoutingState());
  const [recruitingActivity, setRecruitingActivity] = useState<RecruitingActivity>(
    () => loadedSave?.recruitingActivity ?? emptyRecruitingActivity(),
  );
  const [recruitTrends, setRecruitTrends] = useState<Record<string, number>>(() => loadedSave?.recruitTrends ?? {});
  const [assistantReport, setAssistantReport] = useState<AssistantReport | null>(null);
  const [autoRecruitingAssistant, setAutoRecruitingAssistant] = useState<boolean>(
    () => loadedSave?.autoRecruitingAssistant ?? false,
  );
  const [autoRecruitingOffers, setAutoRecruitingOffers] = useState<boolean>(
    () => loadedSave?.autoRecruitingOffers ?? false,
  );
  const [staffState, setStaffState] = useState<ProgramStaffState>(() =>
    loadedSave?.staff
      ? { staff: loadedSave.staff, staffCandidates: loadedSave.staffCandidates ?? [] }
      : createProgramStaff(loadedSave?.dynasty ?? dynasty),
  );
  const [seasonStats, setSeasonStats] = useState<SeasonStatsMap>(() => loadedSave?.seasonStats ?? emptySeasonStats());
  const [careerStats, setCareerStats] = useState<CareerStatsMap>(() => loadedSave?.careerStats ?? emptyCareerStats());
  const [saveStatus, setSaveStatus] = useState(() => (loadedSave ? 'Loaded dynasty save' : 'Choose or create a dynasty'));
  const [recruitPosFilter, setRecruitPosFilter] = useState<LacrossePosition | 'ALL'>('ALL');
  const [recruitTab, setRecruitTab] = useState<'board' | 'portal'>('board');
  const [shortlistIds, setShortlistIds] = useState<string[]>(() => loadedSave?.shortlistIds ?? []);
  const [recruitBoardView, setRecruitBoardView] = useState<'shortlist' | 'all'>(() =>
    (loadedSave?.shortlistIds?.length ?? 0) > 0 ? 'shortlist' : 'all',
  );
  const [coachProfile, setCoachProfile] = useState<CoachProfile | null>(() => loadedSave?.coachProfile ?? null);
  const [adConfidence, setAdConfidence] = useState<number>(() => loadedSave?.adConfidence ?? 60);
  const [seasonGoals, setSeasonGoals] = useState<SeasonGoals | null>(() => loadedSave?.seasonGoals ?? null);
  const [bestNatRank, setBestNatRank] = useState<number | null>(() => loadedSave?.bestNatRank ?? null);
  const [gamePlan, setGamePlan] = useState<LacrosseGamePlan>(() => normalizeGamePlan(loadedSave?.gamePlan));
  const [trainingFocus, setTrainingFocus] = useState<TrainingFocus>(() => loadedSave?.trainingFocus ?? 'balanced');
  const [practicePlan, setPracticePlan] = useState<LacrossePracticePlan>(
    () => loadedSave?.practicePlan ?? defaultPracticePlan(dynasty),
  );
  const [practiceGains, setPracticeGains] = useState<PracticeLogEntry[]>(() => loadedSave?.practiceGains ?? []);
  const [lockerRoom, setLockerRoom] = useState<LockerRoomState>(() => loadedSave?.lockerRoom ?? EMPTY_LOCKER_ROOM);
  const [recordBook, setRecordBook] = useState<RecordBookArchive>(() => loadedSave?.recordBook ?? {});
  const [pendingJobOffers, setPendingJobOffers] = useState<JobOffer[] | null>(() => loadedSave?.pendingJobOffers ?? null);
  const [selectedNewCoachName, setSelectedNewCoachName] = useState(() => generateCoachName(Date.now()));

  const saveState = useCallback((): DynastySaveState => ({
    dynasty,
    lastSimWeek,
    offseasonSummary,
    rankings,
    newsItems,
    tournament,
    dynastyHistory,
    injuries,
    scouting,
    seasonStats,
    careerStats,
    gameLogs: Object.fromEntries(gameLogs),
    coachProfile,
    adConfidence,
    seasonGoals,
    bestNatRank,
    gamePlan,
    trainingFocus,
    practicePlan,
    practiceGains,
    lockerRoom,
    recordBook,
    pendingJobOffers,
    shortlistIds,
    recruitingActivity,
    recruitTrends,
    autoRecruitingAssistant,
    autoRecruitingOffers,
    staff: staffState.staff,
    staffCandidates: staffState.staffCandidates,
  }), [staffState, dynasty, lastSimWeek, offseasonSummary, rankings, newsItems, tournament, dynastyHistory, injuries, scouting, seasonStats, careerStats, gameLogs, coachProfile, adConfidence, seasonGoals, bestNatRank, gamePlan, trainingFocus, practicePlan, practiceGains, lockerRoom, recordBook, pendingJobOffers, shortlistIds, recruitingActivity, recruitTrends, autoRecruitingAssistant, autoRecruitingOffers]);

  const refreshSaves = useCallback(() => setSaves(listDynastySaves()), []);

  const resetUiState = useCallback(() => {
    setView('week-hub');
    setLastSimWeek(null);
    setOffseasonSummary(null);
    setRankings([]);
    setNewsItems([]);
    setSelectedPlayerId(null);
    setTournament(null);
    setDynastyHistory([]);
    setInjuries([]);
    setSelectedBoxScore(null);
    setSelectedRecruitId(null);
    setGameLogs(new Map());
    setScouting(createScoutingState());
    setRecruitingActivity(emptyRecruitingActivity());
    setRecruitTrends({});
    setSeasonStats(emptySeasonStats());
    setCareerStats(emptyCareerStats());
    setRecruitPosFilter('ALL');
    setRecruitTab('board');
    setShortlistIds([]);
    setRecruitBoardView('all');
    setCoachProfile(null);
    setAdConfidence(60);
    setSeasonGoals(null);
    setBestNatRank(null);
    setGamePlan(DEFAULT_GAME_PLAN);
    setTrainingFocus('balanced');
    setPracticeGains([]);
    setLockerRoom(EMPTY_LOCKER_ROOM);
    setRecordBook({});
    setPendingJobOffers(null);
    setAutoRecruitingAssistant(false);
    setAutoRecruitingOffers(false);
    setAssistantReport(null);
  }, []);

  const persistDynasty = useCallback((status = 'Saved locally') => {
    const saveId = activeSaveId ?? createDynastySaveId(dynasty.seed);
    saveDynastySlot({ saveId, state: saveState() });
    setActiveSaveId(saveId);
    refreshSaves();
    setSaveStatus(status);
  }, [activeSaveId, dynasty.seed, refreshSaves, saveState]);

  const startNewDynasty = useCallback(() => {
    const nextDynasty = createFreshLacrosseDynasty({ userTeamId: selectedNewTeamId, ...(customTeams ? { customTeams } : {}) });
    const saveId = createDynastySaveId(nextDynasty.seed);
    const newCoach = createCoachProfile(selectedNewCoachName.trim() || generateCoachName(nextDynasty.seed));
    const userTeamForGoals = nextDynasty.season.teams.find((t) => t.id === selectedNewTeamId);
    const prestige = userTeamForGoals?.reputation.nationalPrestige ?? 50;
    const goals = generateSeasonGoals(
      prestige,
      nextDynasty.season.year,
      countUserGames(nextDynasty.season.schedule, selectedNewTeamId),
    );
    const newStaff = createProgramStaff(nextDynasty);
    resetUiState();
    const preseasonPoll = computeNationalRankings(nextDynasty.season.teams, []);
    setDynasty(nextDynasty);
    setRankings(preseasonPoll);
    setStaffState(newStaff);
    setScouting(withStaffRecruitingHours(createScoutingState(), newStaff.staff));
    setCoachProfile(newCoach);
    setAdConfidence(60);
    setSeasonGoals(goals);
    setBestNatRank(null);
    const newPracticePlan = defaultPracticePlan(nextDynasty);
    setPracticePlan(newPracticePlan);
    const state: DynastySaveState = {
      dynasty: nextDynasty,
      lastSimWeek: null,
      offseasonSummary: null,
      rankings: preseasonPoll,
      newsItems: [],
      tournament: null,
      dynastyHistory: [],
      injuries: [],
      scouting: withStaffRecruitingHours(createScoutingState(), newStaff.staff),
      seasonStats: emptySeasonStats(),
      careerStats: emptyCareerStats(),
      gameLogs: {},
      coachProfile: newCoach,
      adConfidence: 60,
      seasonGoals: goals,
      bestNatRank: null,
      gamePlan: DEFAULT_GAME_PLAN,
      trainingFocus: 'balanced',
      practicePlan: newPracticePlan,
      practiceGains: [],
      lockerRoom: EMPTY_LOCKER_ROOM,
      recordBook: {},
      pendingJobOffers: null,
      shortlistIds: [],
      recruitingActivity: emptyRecruitingActivity(),
      recruitTrends: {},
      autoRecruitingAssistant: false,
      autoRecruitingOffers: false,
      ...newStaff,
    };
    saveDynastySlot({ saveId, state });
    setActiveSaveId(saveId);
    refreshSaves();
    setSaveStatus('New dynasty started');
    setScreen('game');
  }, [customTeams, refreshSaves, resetUiState, selectedNewTeamId, selectedNewCoachName]);

  const loadSave = useCallback((saveId: string) => {
    const save = loadDynastySaveSlot(saveId);
    if (!save) return;
    setDynasty(save.dynasty);
    setLastSimWeek(save.lastSimWeek);
    setOffseasonSummary(save.offseasonSummary);
    setRankings(save.rankings);
    setNewsItems(save.newsItems);
    setSelectedPlayerId(null);
    setTournament(save.tournament);
    setDynastyHistory(save.dynastyHistory);
    setInjuries(save.injuries);
    setSelectedBoxScore(null);
    setSelectedRecruitId(null);
    setGameLogs(new Map(Object.entries(save.gameLogs ?? {})));
    setScouting(save.scouting);
    setStaffState(
      save.staff
        ? { staff: save.staff, staffCandidates: save.staffCandidates ?? [] }
        : createProgramStaff(save.dynasty),
    );
    setRecruitingActivity(save.recruitingActivity ?? emptyRecruitingActivity());
    setRecruitTrends(save.recruitTrends ?? {});
    setAutoRecruitingAssistant(save.autoRecruitingAssistant ?? false);
    setAutoRecruitingOffers(save.autoRecruitingOffers ?? false);
    setAssistantReport(null);
    setSeasonStats(save.seasonStats);
    setCareerStats(save.careerStats ?? emptyCareerStats());
    setCoachProfile(save.coachProfile ?? null);
    setAdConfidence(save.adConfidence ?? 60);
    setSeasonGoals(save.seasonGoals ?? null);
    setBestNatRank(save.bestNatRank ?? null);
    setGamePlan(normalizeGamePlan(save.gamePlan));
    setTrainingFocus(save.trainingFocus ?? 'balanced');
    setPracticePlan(save.practicePlan ?? defaultPracticePlan(save.dynasty));
    setPracticeGains(save.practiceGains ?? []);
    setLockerRoom(save.lockerRoom ?? EMPTY_LOCKER_ROOM);
    setRecordBook(save.recordBook ?? {});
    setPendingJobOffers(save.pendingJobOffers ?? null);
    setShortlistIds(save.shortlistIds ?? []);
    setRecruitBoardView((save.shortlistIds?.length ?? 0) > 0 ? 'shortlist' : 'all');
    setView(save.offseasonSummary ? 'offseason' : 'week-hub');
    setRecruitPosFilter('ALL');
    setRecruitTab('board');
    saveDynastySlot({ saveId, state: save });
    setActiveSaveId(saveId);
    refreshSaves();
    setSaveStatus('Loaded dynasty save');
    setScreen('game');
  }, [refreshSaves]);

  const deleteSave = useCallback((saveId: string) => {
    deleteDynastySave(saveId);
    if (activeSaveId === saveId) {
      setActiveSaveId(null);
    }
    refreshSaves();
    setSaveStatus('Save deleted');
  }, [activeSaveId, refreshSaves]);

  const resetDynasty = useCallback(() => {
    // Clear from localStorage too so the stale active key doesn't trigger autosave on revisit.
    window.localStorage.removeItem(ACTIVE_DYNASTY_SAVE_KEY);
    setActiveSaveId(null);
    setSaveStatus('Choose or create a dynasty');
    refreshSaves();
    setScreen('start');
  }, [refreshSaves]);

  // Don't autosave while on the start screen — prevents stale state from overwriting
  // an existing save before the user has actually started or loaded a dynasty.
  useEffect(() => {
    if (!activeSaveId || screen === 'start') return undefined;
    const timeout = window.setTimeout(() => persistDynasty('Autosaved'), 300);
    return () => window.clearTimeout(timeout);
  }, [activeSaveId, persistDynasty, screen]);

  const updateDepthChartSlot = useCallback((position: LacrossePosition, slotIndex: number, playerId: string) => {
    setDynasty((current) => ({
      ...current,
      season: {
        ...current.season,
        teams: current.season.teams.map((team) =>
          team.id === current.userTeamId
            ? updateLacrosseDepthChartSlot(team, position, slotIndex, playerId)
            : team,
        ),
      },
    }));
    setSaveStatus('Depth chart updated');
  }, []);

  /** Drop every manual depth chart choice, so each position runs in rating order. */
  const resetDepthChart = useCallback(() => {
    setDynasty((current) => ({
      ...current,
      season: {
        ...current.season,
        teams: current.season.teams.map((team) => {
          if (team.id !== current.userTeamId) return team;
          const { depthChart: _manual, ...rest } = team as LacrosseTeam & { depthChart?: unknown };
          return rest as LacrosseTeam;
        }),
      },
    }));
    setSaveStatus('Depth chart reset to the best lineup');
  }, []);

  const userTeam = dynasty.season.teams.find((t) => t.id === dynasty.userTeamId);

  const buildWeekSimState = useCallback((): WeekSimState => ({
    dynasty,
    rankings,
    injuries,
    newsItems,
    scouting,
    recruitingActivity,
    recruitTrends,
    seasonStats,
    gameLogs,
    bestNatRank,
    lastSimWeek,
    userStaff: staffState.staff,
    practicePlan,
    practiceGains,
  }), [staffState.staff, practicePlan, practiceGains, dynasty, rankings, injuries, newsItems, scouting, recruitingActivity, recruitTrends, seasonStats, gameLogs, bestNatRank, lastSimWeek]);

  const applyWeekSimResult = useCallback((result: WeekSimState) => {
    const programName = result.dynasty.season.teams.find((t) => t.id === result.dynasty.userTeamId)?.name;
    const recordNews: NewsItem[] = programName
      ? recordNewsForWeek({
          archive: recordBook,
          careers: careerStats,
          year: result.dynasty.season.year,
          programName,
          programLabel: formatTeamName(programName),
          before: { seasonStats, teams: dynasty.season.teams },
          after: { seasonStats: result.seasonStats, teams: result.dynasty.season.teams },
        }).map((headline, i) => ({
          id: `record-${result.dynasty.season.year}-${result.lastSimWeek ?? 0}-${i}`,
          week: result.lastSimWeek ?? result.dynasty.season.currentWeek,
          category: 'award' as const,
          featured: true,
          headline,
        }))
      : [];
    setDynasty(result.dynasty);
    setRankings(result.rankings);
    setInjuries(result.injuries);
    setNewsItems([...recordNews, ...result.newsItems]);
    setScouting(result.scouting);
    setRecruitingActivity(result.recruitingActivity);
    setRecruitTrends(result.recruitTrends);
    setSeasonStats(result.seasonStats);
    setGameLogs(result.gameLogs);
    setBestNatRank(result.bestNatRank);
    setLastSimWeek(result.lastSimWeek);
    setPracticeGains(result.practiceGains ?? []);
    setAssistantReport(null);
    // Offers the assistant made during the sim pin those recruits, as manual offers do.
    const userId = result.dynasty.userTeamId;
    const offeredIds = result.dynasty.recruits
      .filter((r) => r.status === 'open' && r.scholarshipOffers.some((o) => o.teamId === userId))
      .map((r) => r.id);
    if (offeredIds.length > 0) {
      setShortlistIds((prev) => [...prev, ...offeredIds.filter((id) => !prev.includes(id))]);
    }
  }, [recordBook, careerStats, seasonStats, dynasty.season.teams]);

  // Simming is locked while the offseason is pending; send the coach back there instead.
  const simWeek = useCallback(() => {
    if (offseasonSummary) {
      setView('offseason');
      return;
    }
    const start = autoRecruitingAssistant
      ? applyAssistantToWeekState(buildWeekSimState(), shortlistIds, Math.random, { autoOffer: autoRecruitingOffers }).state
      : buildWeekSimState();
    applyWeekSimResult(simulateOneWeek(start, gamePlan));
  }, [applyWeekSimResult, buildWeekSimState, gamePlan, offseasonSummary, autoRecruitingAssistant, autoRecruitingOffers, shortlistIds]);

  const simToEnd = useCallback(() => {
    if (offseasonSummary) {
      setView('offseason');
      return;
    }
    const beforeWeek = autoRecruitingAssistant
      ? (state: WeekSimState) =>
          applyAssistantToWeekState(state, shortlistIds, Math.random, { autoOffer: autoRecruitingOffers }).state
      : undefined;
    applyWeekSimResult(simulateRemainingWeeks(buildWeekSimState(), gamePlan, Math.random, beforeWeek));
  }, [applyWeekSimResult, buildWeekSimState, gamePlan, offseasonSummary, autoRecruitingAssistant, autoRecruitingOffers, shortlistIds]);

  // The recruiting coordinator spends this week's leftover hours on pitches and scouting.
  const runRecruitingAssistant = useCallback(() => {
    const { state, report } = applyAssistantToWeekState(buildWeekSimState(), shortlistIds, Math.random, {
      suggestOffers: true,
      autoOffer: autoRecruitingOffers,
    });
    if (report.actions.length > 0) {
      setDynasty(state.dynasty);
      setScouting(state.scouting);
      setRecruitingActivity(state.recruitingActivity);
      const offeredIds = report.actions.filter((a) => a.type === 'offer').map((a) => a.recruitId);
      if (offeredIds.length > 0) setShortlistIds((prev) => [...prev, ...offeredIds.filter((id) => !prev.includes(id))]);
    }
    setAssistantReport(report);
    setSaveStatus(summarizeAssistantActions(report.actions));
  }, [buildWeekSimState, shortlistIds, autoRecruitingOffers]);

  // Offers go out one at a time against a running budget, so a batch can't overspend.
  const offerScholarships = useCallback((offers: Array<{ recruitId: string; scholarshipPercent: number }>) => {
    const userTeamLocal = dynasty.season.teams.find((t) => t.id === dynasty.userTeamId);
    if (!userTeamLocal) return;
    let recruits = dynasty.recruits;
    const offeredIds: string[] = [];
    for (const { recruitId, scholarshipPercent } of offers) {
      const recruit = recruits.find((r) => r.id === recruitId);
      if (!recruit) continue;
      const budgetUsed = classScholarshipBudgetUsed(recruits, dynasty.userTeamId);
      const existingOffer = recruit.scholarshipOffers.find((o) => o.teamId === dynasty.userTeamId);
      const additionalCost = (scholarshipPercent - (existingOffer?.scholarshipPercent ?? 0)) / 100;
      if (budgetUsed + additionalCost > LACROSSE_CLASS_SCHOLARSHIP_BUDGET + 1e-9) {
        setSaveStatus('Not enough scholarship budget for that offer');
        continue;
      }
      const updated = applyScholarshipOffer(
        recruit,
        dynasty.userTeamId,
        scholarshipPercent,
        recruitPrestigeMultiplier(recruit.starRating, userTeamLocal.reputation.nationalPrestige),
      );
      recruits = recruits.map((r) => (r.id === recruitId ? updated : r));
      offeredIds.push(recruitId);
    }
    if (offeredIds.length === 0) return;
    const recruitBoard = sortRecruitBoardForTeam(userTeamLocal, recruits, dynasty.rosterTargets);
    setDynasty({ ...dynasty, recruits, recruitBoard });
    // Offering implies you're tracking them — pin to the board automatically.
    setShortlistIds((prev) => [...prev, ...offeredIds.filter((id) => !prev.includes(id))]);
    setAssistantReport((prev) =>
      prev ? { ...prev, suggestedOffers: prev.suggestedOffers.filter((o) => !offeredIds.includes(o.recruitId)) } : prev,
    );
    if (offers.length > 1) setSaveStatus(`Made ${offeredIds.length} scholarship offer${offeredIds.length === 1 ? '' : 's'}`);
  }, [dynasty]);

  const offerScholarship = useCallback(
    (recruitId: string, scholarshipPercent = 100) => offerScholarships([{ recruitId, scholarshipPercent }]),
    [offerScholarships],
  );

  const scholarshipBudget = {
    used: classScholarshipBudgetUsed(dynasty.recruits, dynasty.userTeamId),
    total: LACROSSE_CLASS_SCHOLARSHIP_BUDGET,
  };

  const hasHomeGameThisWeek = dynasty.season.schedule.some(
    (g) =>
      g.week === dynasty.season.currentWeek &&
      g.status === 'scheduled' &&
      g.homeTeamId === dynasty.userTeamId,
  );

  const pitchRecruit = useCallback((recruitId: string, motivation: RecruitMotivation) => {
    const recruit = dynasty.recruits.find((r) => r.id === recruitId);
    const userTeamLocal = dynasty.season.teams.find((t) => t.id === dynasty.userTeamId);
    if (!recruit || !userTeamLocal || recruit.status === 'signed') return;
    if (recruitingActivity.pitchedIds.includes(recruitId)) {
      setSaveStatus('Already pitched this recruit this week');
      return;
    }

    const isFlipAttempt = recruit.status !== 'open' && recruit.committedTeamId !== dynasty.userTeamId;
    const cost = isFlipAttempt ? HOURS_COST.flipPitch : HOURS_COST.pitch;
    const spent = spendRecruitingHours(scouting, cost);
    if (spent === null) {
      setSaveStatus(`Not enough recruiting hours (${cost}h needed)`);
      return;
    }

    const outcome = applyRecruitPitch(
      recruit,
      dynasty.userTeamId,
      motivation,
      recruitPrestigeMultiplier(recruit.starRating, userTeamLocal.reputation.nationalPrestige),
    );
    const recruits = dynasty.recruits.map((r) => (r.id === recruitId ? outcome.recruit : r));
    const recruitBoard = sortRecruitBoardForTeam(userTeamLocal, recruits, dynasty.rosterTargets);
    setDynasty({ ...dynasty, recruits, recruitBoard });
    setScouting(spent);
    setRecruitingActivity((prev) => ({ ...prev, pitchedIds: [...prev.pitchedIds, recruitId] }));

    const name = `${recruit.name.first} ${recruit.name.last}`;
    const statusByResult = {
      strong: `${name} loved the pitch (+${outcome.interestChange} interest)`,
      good: `${name} responded well (+${outcome.interestChange} interest)`,
      lukewarm: `${name} was lukewarm (+${outcome.interestChange} interest)`,
      flat: `The pitch fell flat with ${name} (${outcome.interestChange} interest)`,
    } as const;
    setSaveStatus(statusByResult[outcome.result]);
  }, [dynasty, scouting, recruitingActivity]);

  const toggleVisitInvite = useCallback((recruitId: string) => {
    if (recruitingActivity.visitIds.includes(recruitId)) {
      setRecruitingActivity((prev) => ({ ...prev, visitIds: prev.visitIds.filter((id) => id !== recruitId) }));
      setScouting((s) => ({ ...s, pointsAvailable: s.pointsAvailable + HOURS_COST.visit }));
      setSaveStatus('Visit invite withdrawn — hours refunded');
      return;
    }
    if (!hasHomeGameThisWeek) {
      setSaveStatus('No home game this week to host a visit');
      return;
    }
    const spent = spendRecruitingHours(scouting, HOURS_COST.visit);
    if (spent === null) {
      setSaveStatus(`Not enough recruiting hours (${HOURS_COST.visit}h needed)`);
      return;
    }
    setScouting(spent);
    setRecruitingActivity((prev) => ({ ...prev, visitIds: [...prev.visitIds, recruitId] }));
    setSaveStatus("Campus visit scheduled for this week's home game");
  }, [recruitingActivity, scouting, hasHomeGameThisWeek]);

  const toggleShortlist = useCallback((recruitId: string) => {
    setShortlistIds((prev) =>
      prev.includes(recruitId) ? prev.filter((id) => id !== recruitId) : [...prev, recruitId],
    );
  }, []);

  const doScoutRecruit = useCallback((recruitId: string, trueOvr: number) => {
    setScouting((s) => scoutRecruitFn(s, recruitId, trueOvr, Math.random));
  }, []);

  // Portal offers draw on the program's open scholarship room, not the class budget.
  const offerPortalPlayer = useCallback((portalEntryId: string, scholarshipPercent = 100) => {
    const team = dynasty.season.teams.find((t) => t.id === dynasty.userTeamId);
    const entry = dynasty.portalEntries.find((e) => e.id === portalEntryId);
    if (!team || !entry || entry.status !== 'available') return;
    const existing = entry.offersByTeamId[dynasty.userTeamId] ?? 0;
    const room = portalScholarshipRoom(team, dynasty.portalEntries) + existing / 100;
    if (scholarshipPercent / 100 > room + 1e-9) {
      setSaveStatus('Not enough scholarship room for that portal offer');
      return;
    }
    setDynasty(offerLacrossePortalPlayer(dynasty, portalEntryId, scholarshipPercent));
    setSaveStatus(`Offered ${entry.name.first} ${entry.name.last} a ${scholarshipPercent}% scholarship`);
  }, [dynasty]);

  const withdrawPortalOffer = useCallback((portalEntryId: string) => {
    setDynasty((prev) => withdrawLacrossePortalOffer(prev, portalEntryId));
  }, []);

  const portalScholarshipRoomLeft = userTeam ? portalScholarshipRoom(userTeam, dynasty.portalEntries) : 0;

  const enterTournament = useCallback(() => {
    setTournament(initTournament(dynasty.season.standings, dynasty.season.conferences));
    setView('tournament');
  }, [dynasty.season.standings, dynasty.season.conferences]);

  const tournamentPlanFor = useCallback(
    (team: LacrosseTeam) => (team.id === dynasty.userTeamId ? gamePlan : deriveCpuGamePlan(team)),
    [dynasty.userTeamId, gamePlan],
  );

  const tournamentCoachingFor = useCallback(
    (team: LacrosseTeam) => programCoachingEdge(team, { teamId: dynasty.userTeamId, staff: staffState.staff }),
    [dynasty.userTeamId, staffState.staff],
  );

  // Injured players miss postseason games too.
  const tournamentTeams = useMemo(() => {
    const injuredIds = new Set(injuries.map((inj) => inj.playerId));
    return dynasty.season.teams.map((team) => withoutUnavailable(team, injuredIds));
  }, [dynasty.season.teams, injuries]);

  const simTournamentSemis = useCallback(() => {
    setTournament((prev) => prev ? advanceTournamentSemis(prev, tournamentTeams, tournamentPlanFor, tournamentCoachingFor) : prev);
  }, [tournamentTeams, tournamentPlanFor, tournamentCoachingFor]);

  const simTournamentFinals = useCallback(() => {
    setTournament((prev) =>
      prev ? advanceTournamentFinals(prev, tournamentTeams, tournamentPlanFor, dynasty.season.schedule, tournamentCoachingFor) : prev,
    );
    // The conference weekend is over; a week passes before the NCAA first round.
    setInjuries((prev) => healInjuriesOneWeek(prev));
  }, [tournamentTeams, tournamentPlanFor, tournamentCoachingFor, dynasty.season.schedule]);

  const simNcaaFirstRound = useCallback(() => {
    setTournament((prev) => prev ? advanceNcaaFirstRound(prev, tournamentTeams, tournamentPlanFor, tournamentCoachingFor) : prev);
    setInjuries((prev) => healInjuriesOneWeek(prev));
  }, [tournamentTeams, tournamentPlanFor, tournamentCoachingFor]);

  const simNcaaQuarterfinals = useCallback(() => {
    setTournament((prev) => prev ? advanceNcaaQuarterfinals(prev, tournamentTeams, tournamentPlanFor, tournamentCoachingFor) : prev);
    // Championship weekend plays semis and the final on consecutive days.
    setInjuries((prev) => healInjuriesOneWeek(prev));
  }, [tournamentTeams, tournamentPlanFor, tournamentCoachingFor]);

  const simTournamentNationalSemis = useCallback(() => {
    setTournament((prev) => prev ? advanceTournamentNationalSemis(prev, tournamentTeams, tournamentPlanFor, tournamentCoachingFor) : prev);
  }, [tournamentTeams, tournamentPlanFor, tournamentCoachingFor]);

  const simTournamentNational = useCallback(() => {
    setTournament((prev) => prev ? advanceNationalChampionship(prev, tournamentTeams, tournamentPlanFor, tournamentCoachingFor) : prev);
  }, [tournamentTeams, tournamentPlanFor, tournamentCoachingFor]);

  const enterOffseason = useCallback(() => {
    const tournamentChampion = tournament?.nationalChampion;
    const userConfId = dynasty.season.teams.find((t) => t.id === dynasty.userTeamId)?.conferenceId;
    const userBracket = tournament?.conferenceBrackets.find(b => b.conferenceId === userConfId);
    const isConfChamp = userBracket?.champion === dynasty.userTeamId;
    const isNatChamp = tournamentChampion === dynasty.userTeamId;
    const currentNatRank = rankings.find((r) => r.teamId === dynasty.userTeamId)?.rank ?? null;

    const { newDynasty, summary } = runOffseason(dynasty, tournamentChampion, trainingFocus, seasonStats, staffState.staff);
    const confId = dynasty.season.teams.find((t) => t.id === dynasty.userTeamId)?.conferenceId;
    const confTeamIds = dynasty.season.conferences.find((c) => c.id === confId)?.teamIds ?? [];
    const confRank =
      [...dynasty.season.standings]
        .filter((s) => confTeamIds.includes(s.teamId))
        .sort(compareConferenceStanding)
        .findIndex((s) => s.teamId === dynasty.userTeamId) + 1;

    const userTeamThisSeason = dynasty.season.teams.find((t) => t.id === dynasty.userTeamId);
    const nationalChampionTeam = tournamentChampion
      ? dynasty.season.teams.find((t) => t.id === tournamentChampion)
      : undefined;
    const teamLeader = deriveSeasonLeader(userTeamThisSeason, seasonStats);

    const historyRecord: DynastySeasonRecord = {
      year: dynasty.season.year,
      wins: summary.userRecord.wins,
      losses: summary.userRecord.losses,
      confStanding: confRank || summary.userStanding,
      natRankAtEnd: currentNatRank,
      confChampion: isConfChamp ?? false,
      nationalChampion: isNatChamp,
      signingClassSize: summary.signingClass.length,
      ...(coachProfile ? { coachName: coachProfile.name } : {}),
      ...(userTeamThisSeason ? { teamName: userTeamThisSeason.name } : {}),
      ...(nationalChampionTeam ? { nationalChampionName: nationalChampionTeam.name } : {}),
      awards: toSeasonAwardRecords(summary.awards),
      ...(teamLeader ? { teamLeader } : {}),
    };

    // Staff contracts run down; expiring coaches re-enter the pool asking for a raise.
    const newUserTeam = newDynasty.season.teams.find((t) => t.id === newDynasty.userTeamId);
    const staffTurnover = runStaffOffseason(staffState.staff, {
      seed: newDynasty.seed + newDynasty.season.year,
      prestige: newUserTeam?.reputation.coachingPrestige ?? 50,
      winPct: summary.userRecord.wins / Math.max(1, summary.userRecord.wins + summary.userRecord.losses),
    });
    setStaffState({ staff: staffTurnover.staff, staffCandidates: staffTurnover.candidates });
    setScouting((s) => withStaffRecruitingHours(s, staffTurnover.staff));
    const staffNews: NewsItem[] = staffTurnover.departed.map((member) => ({
      id: `staff-departed-${dynasty.season.year}-${member.id}`,
      week: dynasty.season.currentWeek,
      category: 'coaching' as const,
      featured: true,
      headline: `${STAFF_ROLE_LABELS[member.role].title} ${member.name.first} ${member.name.last}'s contract is up. Re-sign or replace on the Staff screen.`,
    }));
    for (const member of staffTurnover.poached) {
      staffNews.push({
        id: `staff-poached-${dynasty.season.year}-${member.id}`,
        week: dynasty.season.currentWeek,
        category: 'coaching' as const,
        featured: true,
        headline: `${STAFF_ROLE_LABELS[member.role].title} ${member.name.first} ${member.name.last} (${member.rating}) was hired away as a head coach. Find a replacement on the Staff screen.`,
      });
    }
    if (staffNews.length > 0) setNewsItems((prev) => [...staffNews, ...prev]);

    setDynasty(newDynasty);
    setOffseasonSummary(summary);
    // The recruiting class turns over in the offseason; pending pitches/visits
    // and trend arrows refer to recruits who no longer exist.
    setRecruitingActivity(emptyRecruitingActivity());
    setRecruitTrends({});
    setDynastyHistory((h) => [historyRecord, ...h]);
    const careersAfterSeason = recordSeasonToCareer(careerStats, seasonStats, dynasty.season.teams, dynasty.season.year);
    setCareerStats(careersAfterSeason);
    // Departed players' careers are pruned from saves, so their records are kept here.
    const userProgramName = dynasty.season.teams.find((t) => t.id === dynasty.userTeamId)?.name;
    setRecordBook((book) => archiveRecords(book, careersAfterSeason, userProgramName ? [userProgramName] : []));

    // Evaluate season goals and update AD confidence
    if (coachProfile && seasonGoals) {
      const userTeamData = dynasty.season.teams.find((t) => t.id === dynasty.userTeamId);
      const userRecord = userTeamData?.record ?? { wins: 0, losses: 0 };
      // Grade the class that actually signed, after signing-day commits and flips.
      const evaluated = evaluateSeasonGoals(
        seasonGoals,
        userRecord,
        bestNatRank,
        isConfChamp ?? false,
        summary.signingClass.length,
      );
      const { confidence: newConfidence } = updateADConfidence(
        adConfidence,
        evaluated,
        isNatChamp,
        coachProfile,
      );
      const advancedCoach = advanceCoachTenure(coachProfile);
      setSeasonGoals(evaluated);
      setAdConfidence(newConfidence);
      setCoachProfile(advancedCoach);

      if (shouldFireCoach(newConfidence, advancedCoach.tenureSeasons)) {
        const offers = generateJobOffers(
          dynasty.season.teams,
          dynasty.userTeamId,
          dynasty.seed + dynasty.season.year,
        );
        setPendingJobOffers(offers);
        const teamName = userTeamData ? formatTeamName(userTeamData.name) : 'the program';
        setNewsItems((prev) => [
          {
            id: `fired-${dynasty.season.year}`,
            week: dynasty.season.currentWeek,
            category: 'coaching' as const,
            headline: `${advancedCoach.name} has been relieved of his duties at ${teamName}`,
          },
          ...prev,
        ]);
      }
    }

    setView('offseason');
  }, [tournament, dynasty, rankings, coachProfile, seasonGoals, bestNatRank, adConfidence, trainingFocus, seasonStats, careerStats, staffState.staff]);

  const acceptJobOffer = useCallback((teamId: string) => {
    const newTeam = dynasty.season.teams.find((t) => t.id === teamId);
    if (!newTeam) return;
    const recruitBoard = sortRecruitBoardForTeam(newTeam, dynasty.recruits, dynasty.rosterTargets);
    const nextDynasty = { ...dynasty, userTeamId: teamId, recruitBoard };
    setDynasty(nextDynasty);
    // A new job comes with that program's assistants.
    const newStaff = createProgramStaff(nextDynasty);
    setStaffState(newStaff);
    setScouting((s) => withStaffRecruitingHours(s, newStaff.staff));
    setPracticePlan((plan) => ({ ...defaultPracticePlan(nextDynasty), intensity: plan.intensity }));
    setPracticeGains([]);
    setCoachProfile((prev) => (prev ? { name: prev.name, tenureSeasons: 0, contractYearsRemaining: 4 } : prev));
    setAdConfidence(55);
    setPendingJobOffers(null);
    setSaveStatus('Accepted a new coaching job');
  }, [dynasty]);

  const staffBudget = staffBudgetFor(userTeam?.reputation.nationalPrestige ?? 50);

  const hireStaff = useCallback((candidateId: string) => {
    const candidate = staffState.staffCandidates.find((c) => c.id === candidateId);
    if (!candidate) return;
    const result = hireStaffCandidate(staffState.staff, candidate, staffBudget);
    if (!result.ok) {
      setSaveStatus(result.reason);
      return;
    }
    setStaffState({
      staff: result.staff,
      staffCandidates: staffState.staffCandidates.filter((c) => c.id !== candidateId),
    });
    setScouting((s) => withStaffRecruitingHours(s, result.staff));
    setSaveStatus(`Hired ${candidate.name.first} ${candidate.name.last} as ${STAFF_ROLE_LABELS[candidate.role].title}`);
  }, [staffState, staffBudget]);

  const releaseStaff = useCallback((role: StaffRole) => {
    const member = staffState.staff[role];
    if (!member) return;
    const staff = releaseStaffMember(staffState.staff, role);
    setStaffState({ staff, staffCandidates: staffState.staffCandidates });
    setScouting((s) => withStaffRecruitingHours(s, staff));
    setSaveStatus(`Released ${member.name.first} ${member.name.last}`);
  }, [staffState]);

  const updateUserRoster = useCallback((change: (team: LacrosseTeam) => LacrosseTeam) => {
    setDynasty((prev) => ({
      ...prev,
      season: {
        ...prev.season,
        teams: prev.season.teams.map((t) => (t.id === prev.userTeamId ? change(t) : t)),
      },
    }));
  }, []);

  /** A one-on-one: lifts a player's morale, once a season each. */
  const talkToPlayer = useCallback((playerId: string) => {
    if (lockerRoom.talkedIds.includes(playerId)) return;
    const player = userTeam?.roster.find((p) => p.id === playerId);
    if (!player) return;
    updateUserRoster((team) => boostMorale(team, new Set([playerId]), PLAYER_TALK_BOOST));
    setLockerRoom((room) => ({ ...room, talkedIds: [...room.talkedIds, playerId] }));
    setSaveStatus(`Met with ${player.name.first} ${player.name.last}`);
  }, [lockerRoom.talkedIds, userTeam, updateUserRoster]);

  const currentWeekNumber = dynasty.season.currentWeek;
  const meetingReadyWeek = lockerRoom.lastMeetingWeek === null ? null : lockerRoom.lastMeetingWeek + TEAM_MEETING_COOLDOWN;
  const canHoldTeamMeeting = meetingReadyWeek === null || currentWeekNumber >= meetingReadyWeek;

  /** A team meeting lifts everyone a little; players tune out if it's too often. */
  const holdTeamMeeting = useCallback(() => {
    if (!canHoldTeamMeeting) return;
    updateUserRoster((team) => boostMorale(team, 'all', TEAM_MEETING_BOOST));
    setLockerRoom((room) => ({ ...room, lastMeetingWeek: currentWeekNumber }));
    setSaveStatus('Held a team meeting');
  }, [canHoldTeamMeeting, currentWeekNumber, updateUserRoster]);

  const setTeamCaptain = useCallback((playerId: string, captain: boolean) => {
    const player = userTeam?.roster.find((p) => p.id === playerId);
    if (!player) return;
    updateUserRoster((team) => setCaptain(team, playerId, captain));
    setSaveStatus(`${player.name.first} ${player.name.last} ${captain ? 'is a team captain' : 'is no longer a captain'}`);
  }, [userTeam, updateUserRoster]);

  /** Redshirt calls happen during the regular season, not the tournament or offseason. */
  const redshirtsOpen = tournament === null && offseasonSummary === null;
  const gamesPlayedFor = useCallback((playerId: string) => seasonStats[playerId]?.gamesPlayed ?? 0, [seasonStats]);

  const setRedshirt = useCallback((playerId: string, redshirt: boolean) => {
    if (!redshirtsOpen) return;
    const player = userTeam?.roster.find((p) => p.id === playerId);
    if (!player) return;
    updateUserRoster((team) => setLacrosseRedshirt(team, playerId, redshirt, gamesPlayedFor(playerId)));
    setSaveStatus(`${player.name.first} ${player.name.last} ${redshirt ? 'will redshirt this season' : 'is off his redshirt'}`);
  }, [redshirtsOpen, userTeam, updateUserRoster, gamesPlayedFor]);

  const setPracticeIntensity = useCallback((intensity: PracticeIntensity) => {
    setPracticePlan((plan) => ({ ...plan, intensity }));
  }, []);

  /** Add or update one player's plan; a fifth player is refused. */
  const setDevelopmentPlan = useCallback((playerId: string, focus: DevelopmentFocusArea) => {
    setPracticePlan((plan) => {
      const existing = plan.developmentPlans.some((p) => p.playerId === playerId);
      if (!existing && plan.developmentPlans.length >= MAX_DEVELOPMENT_PLANS) return plan;
      const developmentPlans = existing
        ? plan.developmentPlans.map((p) => (p.playerId === playerId ? { playerId, focus } : p))
        : [...plan.developmentPlans, { playerId, focus }];
      return { ...plan, developmentPlans };
    });
  }, []);

  const removeDevelopmentPlan = useCallback((playerId: string) => {
    setPracticePlan((plan) => ({ ...plan, developmentPlans: plan.developmentPlans.filter((p) => p.playerId !== playerId) }));
  }, []);

  /** Fill open plan slots with the staff's picks: the young players with the most room to grow. */
  const autoFillDevelopmentPlans = useCallback(() => {
    if (!userTeam) return;
    setPracticePlan((plan) => {
      const taken = new Set(plan.developmentPlans.map((p) => p.playerId));
      const picks = autoDevelopmentPlans(userTeam, MAX_DEVELOPMENT_PLANS + taken.size).filter((p) => !taken.has(p.playerId));
      return { ...plan, developmentPlans: [...plan.developmentPlans, ...picks].slice(0, MAX_DEVELOPMENT_PLANS) };
    });
  }, [userTeam]);

  const startNewSeason = useCallback(() => {
    // Resolve the portal once, outside the state updater: updaters must be pure,
    // and this one feeds the news feed and several other pieces of state.
    const { dynasty: nextDynasty, moves } = resolveAndApplyPortal(dynasty);
    const portalNews = portalMoveNews(moves, nextDynasty.userTeamId, new Map(nextDynasty.season.teams.map((t) => [t.id, t.name])));
    const userTeamData = nextDynasty.season.teams.find((t) => t.id === nextDynasty.userTeamId);
    const prestige = userTeamData?.reputation.nationalPrestige ?? 50;
    const goals = generateSeasonGoals(
      prestige,
      nextDynasty.season.year,
      countUserGames(nextDynasty.season.schedule, nextDynasty.userTeamId),
    );
    setDynasty(nextDynasty);
    setSeasonGoals(goals);
    setBestNatRank(null);
    setRankings(computeNationalRankings(nextDynasty.season.teams, []));
    // Graduates and transfers drop off their development plans.
    if (userTeamData) setPracticePlan((plan) => prunePracticePlan(plan, userTeamData));
    setPracticeGains([]);
    setLockerRoom(EMPTY_LOCKER_ROOM);
    setOffseasonSummary(null);
    // Empty chairs don't stay empty into the season.
    const filled = fillStaffVacancies(staffState.staff, staffState.staffCandidates, staffBudget);
    setStaffState({ staff: filled.staff, staffCandidates: filled.candidates });
    setScouting((s) => withStaffRecruitingHours(resetScoutingForNewClass(s), filled.staff));
    setNewsItems([
      ...portalNews,
      ...filled.hired.map((member) => ({
        id: `staff-hired-${member.id}`,
        week: 1,
        category: 'coaching' as const,
        featured: true,
        headline: `The athletic department hired ${member.name.first} ${member.name.last} (${member.rating}) as ${STAFF_ROLE_LABELS[member.role].title}.`,
      })),
    ]);
    setLastSimWeek(null);
    setTournament(null);
    setInjuries([]);
    setSelectedPlayerId(null);
    setSelectedBoxScore(null);
    setSelectedRecruitId(null);
    setGameLogs(new Map());
    setSeasonStats(emptySeasonStats());
    setRecruitingActivity(emptyRecruitingActivity());
    setRecruitTrends({});
    setShortlistIds([]);
    setRecruitBoardView('all');
    setView('week-hub');
  }, [dynasty, staffState, staffBudget]);

  const handleExportSave = useCallback((saveId: string) => {
    const json = exportSaveAsJson(saveId);
    if (!json) return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dynasty-save-${saveId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImportSave = useCallback((json: string) => {
    const result = importSaveFromJson(json);
    if ('error' in result) {
      setSaveStatus(`Import failed: ${result.error}`);
    } else {
      setActiveSaveId(result.saveId);
      refreshSaves();
      setSaveStatus('Save imported — click Continue or Load to play');
    }
  }, [refreshSaves]);

  const handleExportTeamsTemplate = useCallback(() => {
    const json = exportDefaultTeamsConfigJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'teams-template.json';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImportTeams = useCallback((json: string) => {
    const result = parseAndValidateCustomTeamsJson(json);
    if (!result.ok) {
      setSaveStatus(`Teams import failed: ${result.message}`);
      return;
    }
    saveCustomTeamsConfig(result.value);
    setCustomTeams(result.value);
    setSelectedNewTeamId(result.value.teams[0]?.id ?? 'maryland-state');
    setSaveStatus(`Custom teams loaded: ${result.value.teams.length} teams across ${result.value.conferences.length} conferences`);
  }, []);

  const handleClearCustomTeams = useCallback(() => {
    clearCustomTeamsConfig();
    setCustomTeams(null);
    setSelectedNewTeamId('maryland-state');
    setSaveStatus('Restored default teams');
  }, []);


  return {
    screen,
    setScreen,
    staff: staffState.staff,
    staffCandidates: staffState.staffCandidates,
    staffBudget,
    hireStaff,
    releaseStaff,
    activeSaveId,
    saves,
    customTeams,
    teamChoices,
    selectedNewTeamId,
    setSelectedNewTeamId,
    selectedNewCoachName,
    setSelectedNewCoachName,
    dynasty,
    view,
    setView,
    lastSimWeek,
    offseasonSummary,
    rankings,
    newsItems,
    selectedPlayerId,
    setSelectedPlayerId,
    selectedRecruitId,
    setSelectedRecruitId,
    tournament,
    dynastyHistory,
    injuries,
    selectedBoxScore,
    setSelectedBoxScore,
    gameLogs,
    scouting,
    seasonStats,
    careerStats,
    saveStatus,
    recruitPosFilter,
    setRecruitPosFilter,
    recruitTab,
    setRecruitTab,
    shortlistIds,
    toggleShortlist,
    recruitBoardView,
    setRecruitBoardView,
    scholarshipBudget,
    coachProfile,
    adConfidence,
    seasonGoals,
    bestNatRank,
    gamePlan,
    setGamePlan,
    trainingFocus,
    setTrainingFocus,
    practicePlan,
    practiceGains,
    setPracticeIntensity,
    setDevelopmentPlan,
    removeDevelopmentPlan,
    autoFillDevelopmentPlans,
    lockerRoom,
    recordBook,
    talkToPlayer,
    holdTeamMeeting,
    setRedshirt,
    setTeamCaptain,
    redshirtsOpen,
    gamesPlayedFor,
    canHoldTeamMeeting,
    meetingReadyWeek,
    pendingJobOffers,
    persistDynasty,
    startNewDynasty,
    loadSave,
    deleteSave,
    resetDynasty,
    updateDepthChartSlot,
    resetDepthChart,
    userTeam,
    simWeek,
    simToEnd,
    offerScholarship,
    offerScholarships,
    doScoutRecruit,
    pitchRecruit,
    toggleVisitInvite,
    recruitingActivity,
    recruitTrends,
    runRecruitingAssistant,
    assistantReport,
    autoRecruitingAssistant,
    setAutoRecruitingAssistant,
    autoRecruitingOffers,
    setAutoRecruitingOffers,
    hasHomeGameThisWeek,
    offerPortalPlayer,
    withdrawPortalOffer,
    portalScholarshipRoom: portalScholarshipRoomLeft,
    enterTournament,
    simTournamentSemis,
    simTournamentFinals,
    simNcaaFirstRound,
    simNcaaQuarterfinals,
    simTournamentNationalSemis,
    simTournamentNational,
    enterOffseason,
    acceptJobOffer,
    startNewSeason,
    handleExportSave,
    handleImportSave,
    handleExportTeamsTemplate,
    handleImportTeams,
    handleClearCustomTeams,
  };
}

function countUserGames(
  schedule: Array<{ homeTeamId: string; awayTeamId: string }>,
  userTeamId: string,
): number {
  return schedule.filter((g) => g.homeTeamId === userTeamId || g.awayTeamId === userTeamId).length;
}

/** A new program starts on a normal week with the staff's picks for individual plans. */
function defaultPracticePlan(dynasty: LacrosseDynastyState): LacrossePracticePlan {
  const team = dynasty.season.teams.find((t) => t.id === dynasty.userTeamId);
  return { intensity: 'normal', developmentPlans: team ? autoDevelopmentPlans(team) : [] };
}
