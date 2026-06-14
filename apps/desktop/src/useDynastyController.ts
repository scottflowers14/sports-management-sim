import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  applyScholarshipOffer,
  classScholarshipBudgetUsed,
  recruitPrestigeMultiplier,
  sortRecruitBoardForTeam,
} from '@sports-management-sim/engine-core';
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
import { simulateOneWeek, simulateRemainingWeeks } from './week-sim';
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
} from './scouting';
import type { ScoutingState } from './scouting';
import { emptySeasonStats } from './stats';
import type { SeasonStatsMap } from './stats';
import { emptyCareerStats, recordSeasonToCareer } from './career-stats';
import type { CareerStatsMap } from './career-stats';
import type { BoxScoreData } from './ui/types';
import { formatTeamName } from './ui/format';
import {
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

type View =
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
  | 'stats';

export function useDynastyController() {
  const [screen, setScreen] = useState<'start' | 'game'>('start');
  const [loadedSave] = useState(() => loadActiveDynastySave());
  const [activeSaveId, setActiveSaveId] = useState<string | null>(() => getActiveDynastySaveId());
  const [saves, setSaves] = useState<DynastySaveMetadata[]>(() => listDynastySaves());
  const [customTeams, setCustomTeams] = useState<CustomTeamsFile | null>(() => loadCustomTeamsConfig());
  const teamChoices = useMemo(() => getLacrosseDynastyTeamChoices(customTeams ?? undefined), [customTeams]);
  const [selectedNewTeamId, setSelectedNewTeamId] = useState(() => teamChoices[0]?.id ?? 'maryland-state');
  const [dynasty, setDynasty] = useState<LacrosseDynastyState>(() => loadedSave?.dynasty ?? createFreshLacrosseDynasty());
  const [view, setView] = useState<View>('week-hub');
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
  const [scouting, setScouting] = useState<ScoutingState>(() => loadedSave?.scouting ?? createScoutingState(3));
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
  }), [dynasty, lastSimWeek, offseasonSummary, rankings, newsItems, tournament, dynastyHistory, injuries, scouting, seasonStats, careerStats, gameLogs, coachProfile, adConfidence, seasonGoals, bestNatRank, gamePlan, trainingFocus, pendingJobOffers, shortlistIds]);

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
    setScouting(createScoutingState(3));
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
      scouting: createScoutingState(3),
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
    setView('week-hub');
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
    setActiveSaveId(null);
    setSaveStatus('Choose or create a dynasty');
    refreshSaves();
    setScreen('start');
  }, [refreshSaves]);

  useEffect(() => {
    if (!activeSaveId) return undefined;
    const timeout = window.setTimeout(() => persistDynasty('Autosaved'), 300);
    return () => window.clearTimeout(timeout);
  }, [activeSaveId, persistDynasty]);

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
    seasonStats,
    gameLogs,
    bestNatRank,
    lastSimWeek,
  }), [dynasty, rankings, injuries, newsItems, scouting, seasonStats, gameLogs, bestNatRank, lastSimWeek]);

  const applyWeekSimResult = useCallback((result: WeekSimState) => {
    setDynasty(result.dynasty);
    setRankings(result.rankings);
    setInjuries(result.injuries);
    setNewsItems(result.newsItems);
    setScouting(result.scouting);
    setSeasonStats(result.seasonStats);
    setGameLogs(result.gameLogs);
    setBestNatRank(result.bestNatRank);
    setLastSimWeek(result.lastSimWeek);
  }, []);

  const simWeek = useCallback(() => {
    applyWeekSimResult(simulateOneWeek(buildWeekSimState(), gamePlan));
  }, [applyWeekSimResult, buildWeekSimState, gamePlan]);

  const simToEnd = useCallback(() => {
    applyWeekSimResult(simulateRemainingWeeks(buildWeekSimState(), gamePlan));
  }, [applyWeekSimResult, buildWeekSimState, gamePlan]);

  const offerScholarship = useCallback((recruitId: string, scholarshipPercent = 100) => {
    const recruit = dynasty.recruits.find((r) => r.id === recruitId);
    const userTeamLocal = dynasty.season.teams.find((t) => t.id === dynasty.userTeamId);
    if (!recruit || !userTeamLocal) return;

    const budgetUsed = classScholarshipBudgetUsed(dynasty.recruits, dynasty.userTeamId);
    const existingOffer = recruit.scholarshipOffers.find((o) => o.teamId === dynasty.userTeamId);
    const additionalCost = (scholarshipPercent - (existingOffer?.scholarshipPercent ?? 0)) / 100;
    if (budgetUsed + additionalCost > LACROSSE_CLASS_SCHOLARSHIP_BUDGET + 1e-9) {
      setSaveStatus('Not enough scholarship budget for that offer');
      return;
    }

    const updated = applyScholarshipOffer(
      recruit,
      dynasty.userTeamId,
      scholarshipPercent,
      recruitPrestigeMultiplier(recruit.starRating, userTeamLocal.reputation.nationalPrestige),
    );
    const recruits = dynasty.recruits.map((r) => (r.id === recruitId ? updated : r));
    const recruitBoard = sortRecruitBoardForTeam(userTeamLocal, recruits, dynasty.rosterTargets);
    setDynasty({ ...dynasty, recruits, recruitBoard });
    // Offering implies you're tracking them — pin to the board automatically.
    setShortlistIds((prev) => (prev.includes(recruitId) ? prev : [...prev, recruitId]));
  }, [dynasty]);

  const scholarshipBudget = {
    used: classScholarshipBudgetUsed(dynasty.recruits, dynasty.userTeamId),
    total: LACROSSE_CLASS_SCHOLARSHIP_BUDGET,
  };

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

  const simTournamentSemis = useCallback(() => {
    setTournament((prev) => prev ? advanceTournamentSemis(prev, dynasty.season.teams, tournamentPlanFor) : prev);
  }, [dynasty.season.teams, tournamentPlanFor]);

  const simTournamentFinals = useCallback(() => {
    setTournament((prev) => prev ? advanceTournamentFinals(prev, dynasty.season.teams, tournamentPlanFor) : prev);
  }, [dynasty.season.teams, tournamentPlanFor]);

  const simTournamentNationalSemis = useCallback(() => {
    setTournament((prev) => prev ? advanceTournamentNationalSemis(prev, dynasty.season.teams, tournamentPlanFor) : prev);
  }, [dynasty.season.teams, tournamentPlanFor]);

  const simTournamentNational = useCallback(() => {
    setTournament((prev) => prev ? advanceNationalChampionship(prev, dynasty.season.teams, tournamentPlanFor) : prev);
  }, [dynasty.season.teams, tournamentPlanFor]);

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
    doScoutRecruit,
    offerPortalPlayer,
    enterTournament,
    simTournamentSemis,
    simTournamentFinals,
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
