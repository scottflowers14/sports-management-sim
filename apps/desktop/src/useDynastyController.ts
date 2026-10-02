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
  offerLacrossePortalPlayer,
  updateLacrosseDepthChartSlot,
} from '@sports-management-sim/sport-lacrosse';
import type { GameLog, LacrosseDynastyState, LacrosseGamePlan, LacrossePosition, LacrosseTeam } from '@sports-management-sim/sport-lacrosse';
import { runOffseason, resolveAndApplyPortal } from './dynasty-helpers';
import type { OffseasonSummary, InjuredPlayer, TrainingFocus } from './dynasty-helpers';
import { simulateOneWeek, simulateRemainingWeeks, withoutInjured } from './week-sim';
import { applyAssistantToWeekState, summarizeAssistantActions, type AssistantReport } from './recruiting-assistant';
import type { WeekSimState } from './week-sim';
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
import {
  initTournament,
  advanceTournamentSemis,
  advanceNcaaFirstRound,
  advanceNcaaQuarterfinals,
  advanceTournamentFinals,
  advanceTournamentNationalSemis,
  advanceNationalChampionship,
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
  | 'offseason'
  | 'news'
  | 'tournament'
  | 'history'
  | 'stats'
  | 'programs'
  | 'players';

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
  const [gamePlan, setGamePlan] = useState<LacrosseGamePlan>(() => loadedSave?.gamePlan ?? DEFAULT_GAME_PLAN);
  const [trainingFocus, setTrainingFocus] = useState<TrainingFocus>(() => loadedSave?.trainingFocus ?? 'balanced');
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
    pendingJobOffers,
    shortlistIds,
    recruitingActivity,
    recruitTrends,
    autoRecruitingAssistant,
    autoRecruitingOffers,
  }), [dynasty, lastSimWeek, offseasonSummary, rankings, newsItems, tournament, dynastyHistory, injuries, scouting, seasonStats, careerStats, gameLogs, coachProfile, adConfidence, seasonGoals, bestNatRank, gamePlan, trainingFocus, pendingJobOffers, shortlistIds, recruitingActivity, recruitTrends, autoRecruitingAssistant, autoRecruitingOffers]);

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
    setPendingJobOffers(null);
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
    resetUiState();
    setDynasty(nextDynasty);
    setCoachProfile(newCoach);
    setAdConfidence(60);
    setSeasonGoals(goals);
    setBestNatRank(null);
    const state: DynastySaveState = {
      dynasty: nextDynasty,
      lastSimWeek: null,
      offseasonSummary: null,
      rankings: [],
      newsItems: [],
      tournament: null,
      dynastyHistory: [],
      injuries: [],
      scouting: createScoutingState(),
      seasonStats: emptySeasonStats(),
      careerStats: emptyCareerStats(),
      gameLogs: {},
      coachProfile: newCoach,
      adConfidence: 60,
      seasonGoals: goals,
      bestNatRank: null,
      gamePlan: DEFAULT_GAME_PLAN,
      trainingFocus: 'balanced',
      pendingJobOffers: null,
      shortlistIds: [],
      recruitingActivity: emptyRecruitingActivity(),
      recruitTrends: {},
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
    setRecruitingActivity(save.recruitingActivity ?? emptyRecruitingActivity());
    setRecruitTrends(save.recruitTrends ?? {});
    setAutoRecruitingAssistant(save.autoRecruitingAssistant ?? false);
    setAutoRecruitingOffers(save.autoRecruitingOffers ?? false);
    setSeasonStats(save.seasonStats);
    setCareerStats(save.careerStats ?? emptyCareerStats());
    setCoachProfile(save.coachProfile ?? null);
    setAdConfidence(save.adConfidence ?? 60);
    setSeasonGoals(save.seasonGoals ?? null);
    setBestNatRank(save.bestNatRank ?? null);
    setGamePlan(save.gamePlan ?? DEFAULT_GAME_PLAN);
    setTrainingFocus(save.trainingFocus ?? 'balanced');
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
  }), [dynasty, rankings, injuries, newsItems, scouting, recruitingActivity, recruitTrends, seasonStats, gameLogs, bestNatRank, lastSimWeek]);

  const applyWeekSimResult = useCallback((result: WeekSimState) => {
    setDynasty(result.dynasty);
    setRankings(result.rankings);
    setInjuries(result.injuries);
    setNewsItems(result.newsItems);
    setScouting(result.scouting);
    setRecruitingActivity(result.recruitingActivity);
    setRecruitTrends(result.recruitTrends);
    setSeasonStats(result.seasonStats);
    setGameLogs(result.gameLogs);
    setBestNatRank(result.bestNatRank);
    setLastSimWeek(result.lastSimWeek);
    setAssistantReport(null);
  }, []);

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

  const offerPortalPlayer = useCallback((portalEntryId: string) => {
    setDynasty((prev) => offerLacrossePortalPlayer(prev, portalEntryId, 100));
  }, []);

  const enterTournament = useCallback(() => {
    setTournament(initTournament(dynasty.season.standings, dynasty.season.conferences));
    setView('tournament');
  }, [dynasty.season.standings, dynasty.season.conferences]);

  const tournamentPlanFor = useCallback(
    (team: LacrosseTeam) => (team.id === dynasty.userTeamId ? gamePlan : deriveCpuGamePlan(team)),
    [dynasty.userTeamId, gamePlan],
  );

  // Injured players miss postseason games too.
  const tournamentTeams = useMemo(() => {
    const injuredIds = new Set(injuries.map((inj) => inj.playerId));
    return dynasty.season.teams.map((team) => withoutInjured(team, injuredIds));
  }, [dynasty.season.teams, injuries]);

  const simTournamentSemis = useCallback(() => {
    setTournament((prev) => prev ? advanceTournamentSemis(prev, tournamentTeams, tournamentPlanFor) : prev);
  }, [tournamentTeams, tournamentPlanFor]);

  const simTournamentFinals = useCallback(() => {
    setTournament((prev) =>
      prev ? advanceTournamentFinals(prev, tournamentTeams, tournamentPlanFor, dynasty.season.schedule) : prev,
    );
  }, [tournamentTeams, tournamentPlanFor, dynasty.season.schedule]);

  const simNcaaFirstRound = useCallback(() => {
    setTournament((prev) => prev ? advanceNcaaFirstRound(prev, tournamentTeams, tournamentPlanFor) : prev);
  }, [tournamentTeams, tournamentPlanFor]);

  const simNcaaQuarterfinals = useCallback(() => {
    setTournament((prev) => prev ? advanceNcaaQuarterfinals(prev, tournamentTeams, tournamentPlanFor) : prev);
  }, [tournamentTeams, tournamentPlanFor]);

  const simTournamentNationalSemis = useCallback(() => {
    setTournament((prev) => prev ? advanceTournamentNationalSemis(prev, tournamentTeams, tournamentPlanFor) : prev);
  }, [tournamentTeams, tournamentPlanFor]);

  const simTournamentNational = useCallback(() => {
    setTournament((prev) => prev ? advanceNationalChampionship(prev, tournamentTeams, tournamentPlanFor) : prev);
  }, [tournamentTeams, tournamentPlanFor]);

  const enterOffseason = useCallback(() => {
    const tournamentChampion = tournament?.nationalChampion;
    const userConfId = dynasty.season.teams.find((t) => t.id === dynasty.userTeamId)?.conferenceId;
    const userBracket = tournament?.conferenceBrackets.find(b => b.conferenceId === userConfId);
    const isConfChamp = userBracket?.champion === dynasty.userTeamId;
    const isNatChamp = tournamentChampion === dynasty.userTeamId;
    const currentNatRank = rankings.find((r) => r.teamId === dynasty.userTeamId)?.rank ?? null;

    const { newDynasty, summary } = runOffseason(dynasty, tournamentChampion, trainingFocus, seasonStats);
    const confId = dynasty.season.teams.find((t) => t.id === dynasty.userTeamId)?.conferenceId;
    const confTeamIds = dynasty.season.conferences.find((c) => c.id === confId)?.teamIds ?? [];
    const confRank =
      [...dynasty.season.standings]
        .filter((s) => confTeamIds.includes(s.teamId))
        .sort((a, b) => b.record.wins - a.record.wins)
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

    setDynasty(newDynasty);
    setOffseasonSummary(summary);
    // The recruiting class turns over in the offseason; pending pitches/visits
    // and trend arrows refer to recruits who no longer exist.
    setRecruitingActivity(emptyRecruitingActivity());
    setRecruitTrends({});
    setDynastyHistory((h) => [historyRecord, ...h]);
    setCareerStats((prev) =>
      recordSeasonToCareer(prev, seasonStats, dynasty.season.teams, dynasty.season.year),
    );

    // Evaluate season goals and update AD confidence
    if (coachProfile && seasonGoals) {
      const userTeamData = dynasty.season.teams.find((t) => t.id === dynasty.userTeamId);
      const userRecord = userTeamData?.record ?? { wins: 0, losses: 0 };
      const recruitClassSize = dynasty.recruits.filter(
        (r) => r.signedTeamId === dynasty.userTeamId || r.committedTeamId === dynasty.userTeamId,
      ).length;
      const evaluated = evaluateSeasonGoals(
        seasonGoals,
        userRecord,
        bestNatRank,
        isConfChamp ?? false,
        recruitClassSize,
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
  }, [tournament, dynasty, rankings, coachProfile, seasonGoals, bestNatRank, adConfidence, trainingFocus, seasonStats]);

  const acceptJobOffer = useCallback((teamId: string) => {
    setDynasty((prev) => {
      const newTeam = prev.season.teams.find((t) => t.id === teamId);
      if (!newTeam) return prev;
      const recruitBoard = sortRecruitBoardForTeam(newTeam, prev.recruits, prev.rosterTargets);
      return { ...prev, userTeamId: teamId, recruitBoard };
    });
    setCoachProfile((prev) => (prev ? { name: prev.name, tenureSeasons: 0, contractYearsRemaining: 4 } : prev));
    setAdConfidence(55);
    setPendingJobOffers(null);
    setSaveStatus('Accepted a new coaching job');
  }, []);

  const startNewSeason = useCallback(() => {
    setDynasty((prev) => {
      const nextDynasty = resolveAndApplyPortal(prev);
      const userTeamData = nextDynasty.season.teams.find((t) => t.id === nextDynasty.userTeamId);
      const prestige = userTeamData?.reputation.nationalPrestige ?? 50;
      const goals = generateSeasonGoals(
        prestige,
        nextDynasty.season.year,
        countUserGames(nextDynasty.season.schedule, nextDynasty.userTeamId),
      );
      setSeasonGoals(goals);
      setBestNatRank(null);
      return nextDynasty;
    });
    setOffseasonSummary(null);
    setNewsItems([]);
    setLastSimWeek(null);
    setRankings([]);
    setTournament(null);
    setInjuries([]);
    setSelectedPlayerId(null);
    setSelectedBoxScore(null);
    setSelectedRecruitId(null);
    setGameLogs(new Map());
    setSeasonStats(emptySeasonStats());
    setScouting((s) => resetScoutingForNewClass(s));
    setRecruitingActivity(emptyRecruitingActivity());
    setRecruitTrends({});
    setShortlistIds([]);
    setRecruitBoardView('all');
    setView('week-hub');
  }, []);

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
    pendingJobOffers,
    persistDynasty,
    startNewDynasty,
    loadSave,
    deleteSave,
    resetDynasty,
    updateDepthChartSlot,
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
