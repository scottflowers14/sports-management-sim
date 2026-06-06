import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  advanceSeasonWeek,
  applyScholarshipOffer,
  sortRecruitBoardForTeam,
} from '@sports-management-sim/engine-core';
import {
  calculateLacrosseTeamRating,
  offerLacrossePortalPlayer,
  simulateLacrosseGameWithLog,
  updateLacrosseDepthChartSlot,
} from '@sports-management-sim/sport-lacrosse';
import type { GameLog, LacrosseDynastyState, LacrossePosition } from '@sports-management-sim/sport-lacrosse';
import { autoCommitWeekly, runOffseason, processInjuries, resolveAndApplyPortal } from './dynasty-helpers';
import type { OffseasonSummary, InjuredPlayer } from './dynasty-helpers';
import {
  createCoachProfile,
  generateCoachName,
  generateSeasonGoals,
  evaluateSeasonGoals,
  updateADConfidence,
  advanceCoachTenure,
  getJobSecurityLabel,
  getJobSecurityColor,
} from './coach-profile';
import type { CoachProfile, SeasonGoals } from './coach-profile';
import { computeNationalRankings } from './rankings';
import type { RankingEntry } from './rankings';
import { generateWeeklyNews, generateRecruitingNews } from './news-feed';
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
import {
  createScoutingState,
  advanceScoutingWeek,
  scoutRecruit as scoutRecruitFn,
  resetScoutingForNewClass,
} from './scouting';
import type { ScoutingState } from './scouting';
import { emptySeasonStats, updateSeasonStats } from './stats';
import type { SeasonStatsMap } from './stats';
import { BoxScorePanel } from './components/BoxScorePanel';
import { PlayerPanel } from './components/PlayerPanel';
import { TeamScreen } from './screens/TeamScreen';
import { ScheduleScreen } from './screens/ScheduleScreen';
import { SeasonScreen } from './screens/SeasonScreen';
import { RecruitingScreen } from './screens/RecruitingScreen';
import { StandingsScreen } from './screens/StandingsScreen';
import { TournamentScreen } from './screens/TournamentScreen';
import { StatsScreen } from './screens/StatsScreen';
import { NewsScreen } from './screens/NewsScreen';
import { OffseasonScreen } from './screens/OffseasonScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { StartScreen } from './screens/StartScreen';
import { formatTeamName } from './ui/format';
import type { BoxScoreData } from './ui/types';
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
import './App.css';

type View =
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

export function App() {
  const [screen, setScreen] = useState<'start' | 'game'>('start');
  const [loadedSave] = useState(() => loadActiveDynastySave());
  const [activeSaveId, setActiveSaveId] = useState<string | null>(() => getActiveDynastySaveId());
  const [saves, setSaves] = useState<DynastySaveMetadata[]>(() => listDynastySaves());
  const [customTeams, setCustomTeams] = useState<CustomTeamsFile | null>(() => loadCustomTeamsConfig());
  const teamChoices = useMemo(() => getLacrosseDynastyTeamChoices(customTeams ?? undefined), [customTeams]);
  const [selectedNewTeamId, setSelectedNewTeamId] = useState(() => teamChoices[0]?.id ?? 'maryland-state');
  const [dynasty, setDynasty] = useState<LacrosseDynastyState>(() => loadedSave?.dynasty ?? createFreshLacrosseDynasty());
  const [view, setView] = useState<View>('season');
  const [lastSimWeek, setLastSimWeek] = useState<number | null>(loadedSave?.lastSimWeek ?? null);
  const [offseasonSummary, setOffseasonSummary] = useState<OffseasonSummary | null>(loadedSave?.offseasonSummary ?? null);
  const [rankings, setRankings] = useState<RankingEntry[]>(loadedSave?.rankings ?? []);
  const [newsItems, setNewsItems] = useState<NewsItem[]>(loadedSave?.newsItems ?? []);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [tournament, setTournament] = useState<TournamentState | null>(loadedSave?.tournament ?? null);
  const [dynastyHistory, setDynastyHistory] = useState<DynastySeasonRecord[]>(loadedSave?.dynastyHistory ?? []);
  const [injuries, setInjuries] = useState<InjuredPlayer[]>(loadedSave?.injuries ?? []);
  const [selectedBoxScore, setSelectedBoxScore] = useState<BoxScoreData | null>(null);
  const [gameLogs, setGameLogs] = useState<Map<string, GameLog>>(() =>
    new Map(Object.entries(loadedSave?.gameLogs ?? {})),
  );
  const [scouting, setScouting] = useState<ScoutingState>(() => loadedSave?.scouting ?? createScoutingState(3));
  const [seasonStats, setSeasonStats] = useState<SeasonStatsMap>(() => loadedSave?.seasonStats ?? emptySeasonStats());
  const [saveStatus, setSaveStatus] = useState(() => (loadedSave ? 'Loaded dynasty save' : 'Choose or create a dynasty'));
  const [recruitPosFilter, setRecruitPosFilter] = useState<LacrossePosition | 'ALL'>('ALL');
  const [recruitTab, setRecruitTab] = useState<'board' | 'portal'>('board');
  const [coachProfile, setCoachProfile] = useState<CoachProfile | null>(() => loadedSave?.coachProfile ?? null);
  const [adConfidence, setAdConfidence] = useState<number>(() => loadedSave?.adConfidence ?? 60);
  const [seasonGoals, setSeasonGoals] = useState<SeasonGoals | null>(() => loadedSave?.seasonGoals ?? null);
  const [bestNatRank, setBestNatRank] = useState<number | null>(() => loadedSave?.bestNatRank ?? null);
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
    gameLogs: Object.fromEntries(gameLogs),
    coachProfile,
    adConfidence,
    seasonGoals,
    bestNatRank,
  }), [dynasty, lastSimWeek, offseasonSummary, rankings, newsItems, tournament, dynastyHistory, injuries, scouting, seasonStats, gameLogs, coachProfile, adConfidence, seasonGoals, bestNatRank]);

  const refreshSaves = useCallback(() => setSaves(listDynastySaves()), []);

  const resetUiState = useCallback(() => {
    setView('season');
    setLastSimWeek(null);
    setOffseasonSummary(null);
    setRankings([]);
    setNewsItems([]);
    setSelectedPlayerId(null);
    setTournament(null);
    setDynastyHistory([]);
    setInjuries([]);
    setSelectedBoxScore(null);
    setGameLogs(new Map());
    setScouting(createScoutingState(3));
    setSeasonStats(emptySeasonStats());
    setRecruitPosFilter('ALL');
    setRecruitTab('board');
    setCoachProfile(null);
    setAdConfidence(60);
    setSeasonGoals(null);
    setBestNatRank(null);
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
    const goals = generateSeasonGoals(prestige, nextDynasty.season.year);
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
      gameLogs: {},
      coachProfile: newCoach,
      adConfidence: 60,
      seasonGoals: goals,
      bestNatRank: null,
    };
    saveDynastySlot({ saveId, state });
    setActiveSaveId(saveId);
    refreshSaves();
    setSaveStatus('New dynasty started');
    setScreen('game');
  }, [refreshSaves, resetUiState, selectedNewTeamId, selectedNewCoachName]);

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
    setGameLogs(new Map(Object.entries(save.gameLogs ?? {})));
    setScouting(save.scouting);
    setSeasonStats(save.seasonStats);
    setCoachProfile(save.coachProfile ?? null);
    setAdConfidence(save.adConfidence ?? 60);
    setSeasonGoals(save.seasonGoals ?? null);
    setBestNatRank(save.bestNatRank ?? null);
    setView('season');
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

  const rankingsRef = useRef<RankingEntry[]>(rankings);
  rankingsRef.current = rankings;
  const injuriesRef = useRef<InjuredPlayer[]>(injuries);
  injuriesRef.current = injuries;

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

  const simWeek = useCallback(() => {
    const weekToSim = dynasty.season.currentWeek;
    const prevCommittedIds = new Set(
      dynasty.recruits.filter((r) => r.status !== 'open').map((r) => r.id),
    );
    const tMap = new Map(dynasty.season.teams.map((t) => [t.id, t.name]));

    setDynasty((prev) => {
      const weekLogs = new Map<string, GameLog>();
      const newSeason = advanceSeasonWeek(prev.season, (game, homeTeam, awayTeam) => {
        const result = simulateLacrosseGameWithLog({ homeTeam, awayTeam });
        weekLogs.set(game.id, result.log);
        return result;
      });
      const newRecruits = autoCommitWeekly(prev.recruits, newSeason.teams, prev.userTeamId, weekToSim, Math.random);
      const updatedUserTeam = newSeason.teams.find((t) => t.id === prev.userTeamId)!;
      const newBoard = sortRecruitBoardForTeam(updatedUserTeam, newRecruits, prev.rosterTargets);
      const newDynasty = { ...prev, season: newSeason, recruits: newRecruits, recruitBoard: newBoard };

      const currentRankings = rankingsRef.current;
      const currentInjuries = injuriesRef.current;
      const newRanks = computeNationalRankings(newSeason.teams, currentRankings);
      const { injuries: newInjuries, newlyInjured, recovered } = processInjuries(
        currentInjuries,
        newSeason.teams,
        Math.random,
      );

      const newlyCommitted = newRecruits.filter(
        (r) => r.status !== 'open' && !prevCommittedIds.has(r.id),
      );

      const weekNews = generateWeeklyNews({
        week: weekToSim,
        season: newSeason,
        previousRankings: currentRankings,
        newRankings: newRanks,
        userTeamId: prev.userTeamId,
        teamMap: tMap,
      });
      const recruitNews = generateRecruitingNews({
        week: weekToSim,
        recruits: newlyCommitted,
        userTeamId: prev.userTeamId,
        teamMap: tMap,
      });
      const injuryNews: NewsItem[] = [
        ...newlyInjured
          .filter((inj) => inj.teamId === prev.userTeamId)
          .map((inj, i) => ({
            id: `injury-${weekToSim}-${i}`,
            week: weekToSim,
            category: 'injury' as const,
            headline: `${inj.playerName} is out ${inj.weeksRemaining} week${inj.weeksRemaining > 1 ? 's' : ''} with an injury`,
          })),
        ...recovered
          .filter((r) => r.teamId === prev.userTeamId)
          .map((r, i) => ({
            id: `recovery-${weekToSim}-${i}`,
            week: weekToSim,
            category: 'injury' as const,
            headline: `${r.playerName} has returned from injury`,
          })),
      ];

      const newSeasonSnap = newSeason;

      setTimeout(() => {
        setRankings(newRanks);
        setInjuries(newInjuries);
        setScouting((s) => advanceScoutingWeek(s));
        setSeasonStats((prev) => updateSeasonStats(prev, newSeasonSnap.schedule, newSeasonSnap.teams, weekToSim));
        setNewsItems((prevNews) => [...weekNews, ...recruitNews, ...injuryNews, ...prevNews].slice(0, 60));
        setLastSimWeek(weekToSim);
        setGameLogs((prev) => {
          const next = new Map(prev);
          for (const [id, log] of weekLogs) next.set(id, log);
          return next;
        });
        const userRank = newRanks.find((r) => r.teamId === prev.userTeamId)?.rank ?? null;
        if (userRank !== null) {
          setBestNatRank((prev) => (prev === null || userRank < prev ? userRank : prev));
        }
      }, 0);

      return newDynasty;
    });
  }, [dynasty.season.currentWeek, dynasty.recruits]);

  const offerScholarship = useCallback((recruitId: string) => {
    setDynasty((prev) => {
      const recruit = prev.recruits.find((r) => r.id === recruitId);
      const userTeamLocal = prev.season.teams.find((t) => t.id === prev.userTeamId);
      if (!recruit || !userTeamLocal) return prev;
      const updated = applyScholarshipOffer(recruit, prev.userTeamId, 100);
      const recruits = prev.recruits.map((r) => (r.id === recruitId ? updated : r));
      const recruitBoard = sortRecruitBoardForTeam(userTeamLocal, recruits, prev.rosterTargets);
      return { ...prev, recruits, recruitBoard };
    });
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

  const simTournamentSemis = useCallback(() => {
    setTournament((prev) => prev ? advanceTournamentSemis(prev, dynasty.season.teams) : prev);
  }, [dynasty.season.teams]);

  const simTournamentFinals = useCallback(() => {
    setTournament((prev) => prev ? advanceTournamentFinals(prev, dynasty.season.teams) : prev);
  }, [dynasty.season.teams]);

  const simTournamentNationalSemis = useCallback(() => {
    setTournament((prev) => prev ? advanceTournamentNationalSemis(prev, dynasty.season.teams) : prev);
  }, [dynasty.season.teams]);

  const simTournamentNational = useCallback(() => {
    setTournament((prev) => prev ? advanceNationalChampionship(prev, dynasty.season.teams) : prev);
  }, [dynasty.season.teams]);

  const enterOffseason = useCallback(() => {
    const tournamentChampion = tournament?.nationalChampion;
    const userConfId = dynasty.season.teams.find((t) => t.id === dynasty.userTeamId)?.conferenceId;
    const userBracket = tournament?.conferenceBrackets.find(b => b.conferenceId === userConfId);
    const isConfChamp = userBracket?.champion === dynasty.userTeamId;
    const isNatChamp = tournamentChampion === dynasty.userTeamId;
    const currentNatRank = rankings.find((r) => r.teamId === dynasty.userTeamId)?.rank ?? null;

    setDynasty((prev) => {
      const { newDynasty, summary } = runOffseason(prev, tournamentChampion);

      const confId = prev.season.teams.find((t) => t.id === prev.userTeamId)?.conferenceId;
      const confTeamIds = prev.season.conferences.find((c) => c.id === confId)?.teamIds ?? [];
      const confRank =
        [...prev.season.standings]
          .filter((s) => confTeamIds.includes(s.teamId))
          .sort((a, b) => b.record.wins - a.record.wins)
          .findIndex((s) => s.teamId === prev.userTeamId) + 1;

      const historyRecord: DynastySeasonRecord = {
        year: prev.season.year,
        wins: summary.userRecord.wins,
        losses: summary.userRecord.losses,
        confStanding: confRank || summary.userStanding,
        natRankAtEnd: currentNatRank,
        confChampion: isConfChamp ?? false,
        nationalChampion: isNatChamp,
        signingClassSize: summary.signingClass.length,
      };

      setTimeout(() => {
        setOffseasonSummary(summary);
        setDynastyHistory((h) => [historyRecord, ...h]);
      }, 0);

      return newDynasty;
    });

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
    }

    setView('offseason');
  }, [tournament, dynasty.userTeamId, dynasty.season.teams, dynasty.season.standings, dynasty.season.conferences, rankings, coachProfile, seasonGoals, bestNatRank, adConfidence, dynasty.recruits]);

  const startNewSeason = useCallback(() => {
    setDynasty((prev) => {
      const nextDynasty = resolveAndApplyPortal(prev);
      const userTeamData = nextDynasty.season.teams.find((t) => t.id === nextDynasty.userTeamId);
      const prestige = userTeamData?.reputation.nationalPrestige ?? 50;
      const goals = generateSeasonGoals(prestige, nextDynasty.season.year);
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
    setGameLogs(new Map());
    setSeasonStats(emptySeasonStats());
    setScouting((s) => resetScoutingForNewClass(s));
    setView('season');
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

  if (screen === 'start') {
    return (
      <StartScreen
        saves={saves}
        teamChoices={teamChoices}
        selectedTeamId={selectedNewTeamId}
        coachName={selectedNewCoachName}
        onTeamChange={setSelectedNewTeamId}
        onCoachNameChange={setSelectedNewCoachName}
        onCreateDynasty={startNewDynasty}
        onLoadSave={(saveId) => { loadSave(saveId); setScreen('game'); }}
        onDeleteSave={deleteSave}
        {...(activeSaveId ? { onContinue: () => setScreen('game') } : {})}
        onExportSave={handleExportSave}
        onImportSave={handleImportSave}
        onExportTeamsTemplate={handleExportTeamsTemplate}
        onImportTeams={handleImportTeams}
        onClearCustomTeams={customTeams ? handleClearCustomTeams : undefined}
        hasCustomTeams={customTeams !== null}
        saveStatus={saveStatus}
      />
    );
  }

  if (!userTeam) return <main>Unable to load dynasty team.</main>;

  const teamMap = new Map(dynasty.season.teams.map((t) => [t.id, t.name]));
  const hasScheduledGames = dynasty.season.schedule.some((g) => g.status === 'scheduled');
  const seasonComplete = !hasScheduledGames;

  const lastWeekGames =
    lastSimWeek !== null
      ? dynasty.season.schedule.filter((g) => g.week === lastSimWeek && g.status === 'final')
      : [];

  const upcomingGames = dynasty.season.schedule
    .filter((g) => g.status === 'scheduled')
    .slice(0, 5);

  const sortedStandings = [...dynasty.season.standings].sort(
    (a, b) => b.record.wins - a.record.wins || a.record.losses - b.record.losses,
  );

  const committedCount = dynasty.recruits.filter(
    (r) => r.committedTeamId === dynasty.userTeamId || r.signedTeamId === dynasty.userTeamId,
  ).length;

  const userRankEntry = rankings.find((r) => r.teamId === dynasty.userTeamId);
  const unreadNewsCount = newsItems.length;
  const userInjuries = new Set(
    injuries.filter((inj) => inj.teamId === dynasty.userTeamId).map((inj) => inj.playerId),
  );
  const injuredCount = injuries.filter((inj) => inj.teamId === dynasty.userTeamId).length;
  const userTeamRating = calculateLacrosseTeamRating(userTeam);

  const playerLookup = buildPlayerLookup(dynasty.season.teams);

  const selectedPlayer = selectedPlayerId ? userTeam.roster.find((p) => p.id === selectedPlayerId) : null;

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">
            Men&apos;s College Lacrosse · Season {dynasty.season.year}
          </p>
          <h1>Sports Management Sim</h1>
          <p className="lede">Build a roster, recruit hotbeds, and chase May.</p>
        </div>
        <section className="card team-card" aria-label="User team summary">
          <span className="label">User Team</span>
          <strong>{formatTeamName(userTeam.name)}</strong>
          <span>
            {seasonComplete
              ? tournament?.phase === 'complete'
                ? 'Tournament Complete'
                : tournament
                  ? 'Conference Tournaments'
                  : 'Season Complete'
              : `Week ${dynasty.season.currentWeek}`}
          </span>
          <span className="record-big">
            {userTeam.record.wins}–{userTeam.record.losses}
          </span>
          {userRankEntry && (
            <span className="national-rank">#{userRankEntry.rank} Nationally</span>
          )}
          {injuredCount > 0 && (
            <span className="injury-count">{injuredCount} injured</span>
          )}
          {coachProfile && (
            <div className="coach-block">
              <span className="coach-name">HC {coachProfile.name}</span>
              <span className="coach-tenure">
                Year {coachProfile.tenureSeasons + 1} · {coachProfile.contractYearsRemaining}yr left
              </span>
              <div className="ad-confidence-row">
                <span className="ad-confidence-label" style={{ color: getJobSecurityColor(adConfidence) }}>
                  {getJobSecurityLabel(adConfidence)}
                </span>
                <div className="ad-confidence-bar-track">
                  <div
                    className="ad-confidence-bar-fill"
                    style={{
                      width: `${adConfidence}%`,
                      background: getJobSecurityColor(adConfidence),
                    }}
                  />
                </div>
                <span className="ad-confidence-pct">{adConfidence}</span>
              </div>
            </div>
          )}
          {seasonGoals && (
            <div className="season-goals">
              <span className="label">Season Goals</span>
              <ul className="goals-list">
                {seasonGoals.goals.map((goal) => (
                  <li
                    key={goal.id}
                    className={
                      goal.achieved === true
                        ? 'goal-met'
                        : goal.achieved === false
                          ? 'goal-missed'
                          : 'goal-pending'
                    }
                  >
                    <span className="goal-icon">
                      {goal.achieved === true ? '✓' : goal.achieved === false ? '✗' : '·'}
                    </span>
                    {goal.description}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="save-actions" aria-label="Save controls">
            <button type="button" onClick={() => persistDynasty()}>
              Save Now
            </button>
            <button type="button" onClick={resetDynasty}>
              New Dynasty
            </button>
            <span>{saveStatus}</span>
          </div>
        </section>
      </header>

      <nav className="tab-bar" aria-label="Main navigation">
        {(['season', 'team', 'schedule', 'recruiting', 'standings'] as const).map((v) => (
          <button
            key={v}
            className={view === v ? 'tab active' : 'tab'}
            onClick={() => setView(v)}
          >
            {v === 'recruiting' && committedCount > 0
              ? `Recruiting · ${committedCount}`
              : v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
        {(seasonComplete || tournament !== null) && (
          <button
            className={view === 'tournament' ? 'tab active' : 'tab'}
            onClick={() => setView('tournament')}
          >
            Tournament
            {tournament?.nationalChampion && <span className="tab-badge">✓</span>}
          </button>
        )}
        <button
          className={view === 'stats' ? 'tab active' : 'tab'}
          onClick={() => setView('stats')}
        >
          Stats
        </button>
        <button
          className={view === 'news' ? 'tab active' : 'tab'}
          onClick={() => setView('news')}
        >
          News
          {unreadNewsCount > 0 && <span className="tab-badge">{unreadNewsCount}</span>}
        </button>
        <button
          className={view === 'history' ? 'tab active' : 'tab'}
          onClick={() => setView('history')}
        >
          History
        </button>
        {view === 'offseason' && <button className="tab active">Offseason</button>}
      </nav>

      {view === 'season' && (
        <SeasonScreen
          currentWeek={dynasty.season.currentWeek}
          seasonComplete={seasonComplete}
          tournament={tournament}
          lastSimWeek={lastSimWeek}
          lastWeekGames={lastWeekGames}
          newsItems={newsItems}
          userTeam={userTeam}
          userInjuries={userInjuries}
          injuredCount={injuredCount}
          userTeamRating={userTeamRating}
          upcomingGames={upcomingGames}
          teamMap={teamMap}
          userTeamId={dynasty.userTeamId}
          gameLogs={gameLogs}
          onSimWeek={simWeek}
          onEnterTournament={enterTournament}
          onViewTournament={() => setView('tournament')}
          onEnterOffseason={enterOffseason}
          onBoxScore={setSelectedBoxScore}
          onSelectPlayer={setSelectedPlayerId}
        />
      )}

      {view === 'team' && (
        <TeamScreen
          team={userTeam}
          injuries={userInjuries}
          injuredCount={injuredCount}
          rating={userTeamRating}
          onSelectPlayer={setSelectedPlayerId}
          onDepthChartChange={updateDepthChartSlot}
        />
      )}

      {view === 'schedule' && (
        <ScheduleScreen
          schedule={dynasty.season.schedule}
          teams={dynasty.season.teams}
          teamMap={teamMap}
          userTeamId={dynasty.userTeamId}
          currentWeek={dynasty.season.currentWeek}
          gameLogs={gameLogs}
          onBoxScore={setSelectedBoxScore}
        />
      )}

      {view === 'recruiting' && (
        <RecruitingScreen
          recruitBoard={dynasty.recruitBoard}
          portalEntries={dynasty.portalEntries}
          scouting={scouting}
          userTeamId={dynasty.userTeamId}
          teamMap={teamMap}
          currentWeek={dynasty.season.currentWeek}
          recruitPosFilter={recruitPosFilter}
          recruitTab={recruitTab}
          onOfferScholarship={offerScholarship}
          onScoutRecruit={doScoutRecruit}
          onOfferPortalPlayer={offerPortalPlayer}
          onRecruitPosFilterChange={setRecruitPosFilter}
          onRecruitTabChange={setRecruitTab}
        />
      )}

      {view === 'standings' && (
        <StandingsScreen
          rankings={rankings}
          sortedStandings={sortedStandings}
          teams={dynasty.season.teams}
          conferences={dynasty.season.conferences}
          userTeamId={dynasty.userTeamId}
          teamMap={teamMap}
        />
      )}

      {view === 'tournament' && (
        <TournamentScreen
          tournament={tournament}
          teamMap={teamMap}
          userTeamId={dynasty.userTeamId}
          seasonComplete={seasonComplete}
          onSimSemis={simTournamentSemis}
          onSimFinals={simTournamentFinals}
          onSimNationalSemis={simTournamentNationalSemis}
          onSimNational={simTournamentNational}
          onEnterOffseason={enterOffseason}
          onInitTournament={enterTournament}
          onBoxScore={setSelectedBoxScore}
        />
      )}

      {view === 'stats' && (
        <StatsScreen
          seasonStats={seasonStats}
          playerLookup={playerLookup}
          userTeamId={dynasty.userTeamId}
        />
      )}

      {view === 'news' && (
        <NewsScreen newsItems={newsItems} />
      )}

      {view === 'history' && (
        <HistoryScreen history={dynastyHistory} />
      )}

      {view === 'offseason' && offseasonSummary && (
        <OffseasonScreen
          offseasonSummary={offseasonSummary}
          userTeam={userTeam}
          portalEntries={dynasty.portalEntries}
          teamMap={teamMap}
          dynastyHistory={dynastyHistory}
          seasonYear={dynasty.season.year}
          userTeamId={dynasty.userTeamId}
          onStartNewSeason={startNewSeason}
          onOfferPortalPlayer={offerPortalPlayer}
        />
      )}

      {selectedPlayer && (
        <PlayerPanel
          player={selectedPlayer}
          isInjured={userInjuries.has(selectedPlayer.id)}
          injuryData={injuries.find(
            (inj) => inj.playerId === selectedPlayer.id && inj.teamId === dynasty.userTeamId,
          )}
          playerStats={seasonStats[selectedPlayer.id]}
          onClose={() => setSelectedPlayerId(null)}
        />
      )}

      {selectedBoxScore && (
        <BoxScorePanel data={selectedBoxScore} onClose={() => setSelectedBoxScore(null)} />
      )}
    </main>
  );
}

function buildPlayerLookup(
  teams: Array<{ id: string; name: string; roster: Array<{ id: string; name: { first: string; last: string }; position: string }> }>,
): Map<string, { name: string; teamName: string; position: string; teamId: string }> {
  const map = new Map<string, { name: string; teamName: string; position: string; teamId: string }>();
  for (const team of teams) {
    for (const player of team.roster) {
      map.set(player.id, {
        name: `${player.name.first} ${player.name.last}`,
        teamName: team.name,
        position: player.position,
        teamId: team.id,
      });
    }
  }
  return map;
}
