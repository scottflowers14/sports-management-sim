import { legacyScore, legacyTier } from './legacy';
import { AchievementWatchCard } from './components/AchievementWatchCard';
import { achievementWatch } from './achievements';
import { cpuRecruitingScale, DIFFICULTY_LABELS, userDecisionScale } from './difficulty';
import { landChance, landChances } from './recruit-odds';
import { seasonReport } from './season-report';
import {
  calculateLacrosseTeamRating,
  deriveCpuGamePlan,
  leagueTendencies,
  scoutingKeys,
  taleOfTheTape,
  teamStatRankings,
  teamTendencies,
  STAFF_ROLE_LABELS,
  MAX_DEVELOPMENT_PLANS,
  dynastyRivalries,
  rivalryFor,
  rivalryForGame,
  seriesSummary,
  suggestRedshirts,
  teamCaptains,
  STAFF_ROLES,
  seasonAttendance,
} from '@sports-management-sim/sport-lacrosse';
import type { StandingsEntry } from '@sports-management-sim/engine-core';
import type { LacrosseTeam, LacrosseTeamStats } from '@sports-management-sim/sport-lacrosse';
import { classNeedsByPosition } from '@sports-management-sim/engine-core';

import { getJobSecurityLabel, getJobSecurityColor } from './coach-profile';
import { BoxScorePanel } from './components/BoxScorePanel';
import { PlayerPanel } from './components/PlayerPanel';
import { RecruitPanel } from './components/RecruitPanel';
import { TeamScreen } from './screens/TeamScreen';
import { ScheduleScreen } from './screens/ScheduleScreen';
import { SeasonScreen } from './screens/SeasonScreen';
import { buildWeeklyHub } from './weekly-hub';
import { RecruitingScreen } from './screens/RecruitingScreen';
import { StandingsScreen } from './screens/StandingsScreen';
import { TournamentScreen } from './screens/TournamentScreen';
import { StatsScreen } from './screens/StatsScreen';
import { NewsScreen } from './screens/NewsScreen';
import { OffseasonScreen } from './screens/OffseasonScreen';
import { StaffScreen } from './screens/StaffScreen';
import { PracticeScreen } from './screens/PracticeScreen';
import { LockerRoomScreen } from './screens/LockerRoomScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { ACHIEVEMENTS, achievementPoints, profileLevel, profileTitle } from './achievements';
import { AchievementToast } from './components/AchievementToast';
import { CoachChecklistCard, WelcomeModal } from './components/CoachChecklist';
import { GameRevealModal } from './components/GameRevealModal';
import { buildGameReveal } from './game-reveal';
import { offseasonTodos, spendableInvestmentPoints, startSeasonWarning } from './offseason-todo';
import { ConfirmModal } from './components/ConfirmModal';
import { TickerNumber, RankMove } from './ui/Ticker';
import { coachGuideSteps, showCoachGuide } from './coach-guide';
import { RecordsScreen } from './screens/RecordsScreen';
import { SeasonPreviewCard } from './components/SeasonPreviewCard';
import { HalftimeModal } from './components/HalftimeModal';
import { recruitingPipelines } from './pipelines';
import { playerGameLog } from './player-game-log';
import { TeamTalkCard } from './components/TeamTalkCard';
import { allSeries, userSeasonGames } from './series-history';
import { playerHonors } from './history';
import { TOURNAMENT_ROUND_LABELS, opponentThisRound, projectNcaaField, projectionStatus, stillAlive } from './tournament';
import type { OpponentScout } from './components/GamePlanPanel';
import { PregameModal } from './components/PregameModal';
import { PressConferenceCard } from './components/PressConferenceCard';
import { WeekHubScreen } from './screens/WeekHubScreen';
import { StartScreen } from './screens/StartScreen';
import { ProgramsScreen } from './screens/ProgramsScreen';
import { PlayersScreen } from './screens/PlayersScreen';
import { useEffect, useState } from 'react';
import { FormWatchCard } from './components/FormWatchCard';
import { rosterForm } from './player-form';
import { powerRankingBlurbs } from './power-rankings';
import { formatTeamName, formatTeamShort } from './ui/format';
import { useDynastyController, type View } from './useDynastyController';
import './App.css';

const CLASS_NEED_POSITIONS = ['ATT', 'MID', 'DEF', 'LSM', 'FOGO', 'GK'] as const;

export function App() {
  const {
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
    selectedNewDifficulty,
    setSelectedNewDifficulty,
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
    recordBook,
    rivalrySeries,
    weeklyHonors,
    investmentPlan,
    investmentBudget,
    fundInvestment,
    unfundInvestment,
    seasonPreview,
    hallOfFame,
    proDraftHistory,
    upgradeCoachAbility,
    scheduleEditable,
    swapNonConferenceGame,
    saveStatus,
    saveError,
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
    gamePlan,
    setGamePlan,
    autoGamePlan,
    restoreStaffGamePlan,
    trainingFocus,
    setTrainingFocus,
    staff,
    staffCandidates,
    staffBudget,
    hireStaff,
    releaseStaff,
    practicePlan,
    practiceGains,
    setPracticeIntensity,
    setDevelopmentPlan,
    removeDevelopmentPlan,
    autoFillDevelopmentPlans,
    lockerRoom,
    talkToPlayer,
    holdTeamMeeting,
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
    setRedshirt,
    setTeamCaptain,
    promisePlayingTime,
    redshirtsOpen,
    gamesPlayedFor,
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
    achievements,
    achievementSnapshot,
    challengeLog,
    achievementToasts,
    levelUp,
    dismissAchievementToasts,
    profile,
    setAutoRecruitingOffers,
    hasHomeGameThisWeek,
    offerPortalPlayer,
    withdrawPortalOffer,
    portalScholarshipRoom,
    answerRealignmentInvite,
    pressConference,
    answerPressConference,
    canCoachGame,
    coachGame,
    simToOffseason,
    halftime,
    playSecondHalf,
    nil,
    retainWithNil,
    rushInjuredPlayer,
    teamTalk,
    giveTeamTalk,
    signNilDeal,
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
    ncaaBracketOdds,
    coachGuide,
    markGuideVisited,
    dismissCoachGuide,
    acknowledgeWelcome,
    pendingReveal,
    dismissReveal,
  } = useDynastyController();

  useEffect(() => {
    if (screen === 'game') markGuideVisited(view);
  }, [screen, view, markGuideVisited]);
  const [viewedProgramId, setViewedProgramId] = useState<string | null>(null);
  /** Asking before a season starts with offseason decisions left undone. */
  const [confirmStart, setConfirmStart] = useState(false);
  /** Coach the Game opens on the pregame plan before the first half. */
  const [pregameOpen, setPregameOpen] = useState(false);

  if (screen === 'start') {
    return (
      <StartScreen
        saves={saves}
        teamChoices={teamChoices}
        selectedTeamId={selectedNewTeamId}
        coachName={selectedNewCoachName}
        onTeamChange={setSelectedNewTeamId}
        onCoachNameChange={setSelectedNewCoachName}
        difficulty={selectedNewDifficulty}
        onDifficultyChange={setSelectedNewDifficulty}
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
        profileSummary={{
          level: profileLevel(achievementPoints(profile.achievements)).level,
          unlocked: Object.keys(profile.achievements).length,
          total: ACHIEVEMENTS.length,
          points: achievementPoints(profile.achievements),
        }}
        saveLegacies={Object.fromEntries(
          Object.entries(profile.careers).map(([saveId, career]) => [saveId, legacyTier(legacyScore(career))]),
        )}
      />
    );
  }

  if (!userTeam) return <main>Unable to load dynasty team.</main>;

  const teamMap = new Map(dynasty.season.teams.map((t) => [t.id, t.name]));
  const hasScheduledGames = dynasty.season.schedule.some((g) => g.status === 'scheduled');
  const seasonComplete = !hasScheduledGames;

  const rankById = new Map(rankings.map((r) => [r.teamId, r.rank]));
  const rankOf = (teamId: string) => rankById.get(teamId) ?? null;

  const lastWeekGames =
    lastSimWeek !== null
      ? dynasty.season.schedule.filter((g) => g.week === lastSimWeek && g.status === 'final')
      : [];

  const upcomingGames = dynasty.season.schedule
    .filter((g) => g.status === 'scheduled')
    .slice(0, 5);

  // Fill in 0-0 placeholder entries for teams that haven't played yet so the
  // standings table is visible from day one, not just after the first game.
  const standingsById = new Map(dynasty.season.standings.map((s) => [s.teamId, s]));
  const fullStandings: StandingsEntry[] = dynasty.season.teams.map(
    (team) =>
      standingsById.get(team.id) ?? {
        teamId: team.id,
        conferenceId: team.conferenceId,
        record: { wins: 0, losses: 0, conferenceWins: 0, conferenceLosses: 0, homeWins: 0, homeLosses: 0, awayWins: 0, awayLosses: 0, neutralWins: 0, neutralLosses: 0 },
        pointsFor: 0,
        pointsAgainst: 0,
        strengthOfSchedule: 0,
        rankingScore: 0,
      },
  );
  const sortedStandings = [...fullStandings].sort(
    (a, b) => b.record.wins - a.record.wins || a.record.losses - b.record.losses,
  );

  // Bracketology runs through the regular season, once anyone has played.
  const ncaaProjection =
    !tournament && dynasty.season.schedule.some((g) => g.status === 'final')
      ? projectNcaaField(dynasty.season.teams, dynasty.season.conferences, fullStandings, dynasty.season.schedule)
      : null;

  const committedCount = dynasty.recruits.filter(
    (r) => r.committedTeamId === dynasty.userTeamId || r.signedTeamId === dynasty.userTeamId,
  ).length;

  const userRankEntry = rankings.find((r) => r.teamId === dynasty.userTeamId);
  const guideActive = showCoachGuide(coachGuide, dynastyHistory.length);
  const vacantStaffRoles = STAFF_ROLES.filter((role) => !staff[role]).map((role) => STAFF_ROLE_LABELS[role].title.toLowerCase());
  const spendablePoints = spendableInvestmentPoints(investmentBudget, investmentPlan);
  const todos =
    offseasonSummary && !pendingJobOffers
      ? offseasonTodos({
          investmentBudget,
          investmentPlan,
          portalAvailable: dynasty.portalEntries.filter((e) => e.status === 'available').length,
          portalOffers: dynasty.portalEntries.filter((e) => e.status === 'available' && e.offersByTeamId[dynasty.userTeamId] !== undefined).length,
          scholarshipRoom: portalScholarshipRoom,
          vacantStaffRoles,
          realignmentPending: Boolean(offseasonSummary.realignmentInvite),
        })
      : null;
  const startWarning = todos ? startSeasonWarning(todos, spendablePoints) : null;
  const guardedStartSeason = () => (startWarning ? setConfirmStart(true) : startNewSeason());
  const revealGame = pendingReveal ? dynasty.season.schedule.find((g) => g.id === pendingReveal.gameId) : undefined;
  const revealData = (() => {
    if (!pendingReveal || !revealGame?.result) return null;
    const reveal = buildGameReveal(revealGame, gameLogs.get(revealGame.id), dynasty.userTeamId, {
      userRank: pendingReveal.userRank,
      opponentRank: pendingReveal.opponentRank,
      trophy: rivalryForGame(dynastyRivalries(dynasty), revealGame)?.trophy ?? null,
    });
    if (!reveal) return null;
    const { result } = revealGame;
    const log = gameLogs.get(revealGame.id);
    const boxScore = result.teamStats
      ? {
          title: `Week ${revealGame.week}`,
          homeTeamName: teamMap.get(revealGame.homeTeamId) ?? revealGame.homeTeamId,
          awayTeamName: teamMap.get(revealGame.awayTeamId) ?? revealGame.awayTeamId,
          homeScore: result.homeScore,
          awayScore: result.awayScore,
          overtime: result.overtime,
          homeStats: result.teamStats.home as LacrosseTeamStats,
          awayStats: result.teamStats.away as LacrosseTeamStats,
          ...(log ? { log } : {}),
        }
      : null;
    return { reveal, boxScore };
  })();
  // Badge the stories about our program from the latest simulated week.
  const latestNewsWeek = newsItems[0]?.week;
  const unreadNewsCount = newsItems.filter((n) => n.week === latestNewsWeek && n.featured).length;
  const userInjuries = new Set(
    injuries.filter((inj) => inj.teamId === dynasty.userTeamId).map((inj) => inj.playerId),
  );
  const injuredCount = injuries.filter((inj) => inj.teamId === dynasty.userTeamId).length;
  const userTeamRating = calculateLacrosseTeamRating(userTeam);

  const playerLookup = buildPlayerLookup(dynasty.season.teams);

  const unhappyCount = userTeam.roster.filter((p) => p.morale < 50).length;
  const rivalries = dynastyRivalries(dynasty);
  const userRivalry = rivalryFor(rivalries, userTeam.id);
  const rivalGameThisWeek = userRivalry
    ? dynasty.season.schedule.find(
        (g) => g.week === dynasty.season.currentWeek && g.status !== 'final' && rivalryForGame([userRivalry], g) !== null,
      )
    : undefined;
  const rivalId = userRivalry?.teamIds.find((id) => id !== userTeam.id);
  const rivalryWeek =
    rivalGameThisWeek && userRivalry && rivalId
      ? `Rivalry week: ${userRivalry.trophy} is on the line against ${formatTeamName(teamMap.get(rivalId) ?? rivalId)} (${seriesSummary(rivalrySeries[userRivalry.key], userTeam.id, rivalId).toLowerCase()}). The result hits morale three times as hard.`
      : undefined;
  // Only nudge before the opener, and only until the coach has made a call.
  const redshirtSuggestions =
    redshirtsOpen && !userTeam.roster.some((p) => p.redshirtStatus === 'redshirting') && dynasty.season.currentWeek <= 1
      ? suggestRedshirts(userTeam, gamesPlayedFor).length
      : 0;

  const keyPositions = new Set(['GK', 'FOGO']);
  const highPriorityCount = injuries.filter((inj) => {
    if (inj.teamId !== dynasty.userTeamId) return false;
    const player = userTeam.roster.find((p) => p.id === inj.playerId);
    return player && keyPositions.has(player.position);
  }).length;

  const nextUserGame = dynasty.season.schedule.find(
    (g) => g.status === 'scheduled' && (g.homeTeamId === dynasty.userTeamId || g.awayTeamId === dynasty.userTeamId),
  );
  const nextOpponentTeam = nextUserGame
    ? dynasty.season.teams.find(
        (t) => t.id === (nextUserGame.homeTeamId === dynasty.userTeamId ? nextUserGame.awayTeamId : nextUserGame.homeTeamId),
      )
    : undefined;
  const userForm = rosterForm(userTeam.roster, dynasty.season.schedule, gameLogs);
  const league = leagueTendencies(dynasty.season.schedule);
  const statRanks = teamStatRankings(dynasty.season.schedule, dynasty.season.teams.map((t) => t.id));
  const scoutFor = (opponent: LacrosseTeam, isHome: boolean, week: number, label?: string): OpponentScout => {
    const tendencies = teamTendencies(dynasty.season.schedule, opponent.id);
    return {
      tendencies,
      keys: tendencies && league ? scoutingKeys(tendencies, league) : [],
      week,
      ...(label ? { label } : {}),
      name: formatTeamName(opponent.name),
      isHome,
      plan: deriveCpuGamePlan(opponent),
      rating: calculateLacrosseTeamRating(opponent).overall,
      tape: taleOfTheTape(statRanks, dynasty.userTeamId, opponent.id),
    };
  };
  const nextOpponentScout =
    nextUserGame && nextOpponentTeam
      ? scoutFor(nextOpponentTeam, nextUserGame.homeTeamId === dynasty.userTeamId, nextUserGame.week)
      : null;
  // In the postseason the scout covers this round's opponent.
  const roundOpponent = tournament ? opponentThisRound(tournament, dynasty.userTeamId) : null;
  const roundOpponentTeam = roundOpponent ? dynasty.season.teams.find((t) => t.id === roundOpponent.opponentId) : undefined;
  const pregameScout =
    tournament && roundOpponent && roundOpponentTeam
      ? scoutFor(roundOpponentTeam, roundOpponent.isHome, dynasty.season.currentWeek, TOURNAMENT_ROUND_LABELS[tournament.phase])
      : nextOpponentScout;

  const seriesByOpponent = allSeries(dynastyHistory, {
    year: dynasty.season.year,
    games: userSeasonGames(dynasty.season.schedule, tournament, dynasty.userTeamId),
  });
  const baseWeeklyHub = buildWeeklyHub({
    schedule: dynasty.season.schedule,
    teams: dynasty.season.teams,
    userTeamId: dynasty.userTeamId,
    currentWeek: dynasty.season.currentWeek,
    rankings,
    seasonStats,
  });
  const nextSeries = baseWeeklyHub ? seriesByOpponent.get(baseWeeklyHub.preview.opponent.id) : undefined;
  const weeklyHub = baseWeeklyHub && nextSeries ? { ...baseWeeklyHub, series: nextSeries } : baseWeeklyHub;

  // Player cards are reusable across the whole league, not just the user roster.
  const selectedPlayer = selectedPlayerId
    ? dynasty.season.teams.flatMap((t) => t.roster).find((p) => p.id === selectedPlayerId)
    : null;
  const selectedRecruit = selectedRecruitId ? dynasty.recruits.find((r) => r.id === selectedRecruitId) : null;
  // Chance to land each open recruit; only worked out where it's shown.
  const landContext = {
    userTeam,
    teams: dynasty.season.teams,
    currentWeek: dynasty.season.currentWeek,
    finalWeek: dynasty.season.schedule.reduce((max, g) => Math.max(max, g.week), 0) || 10,
    decisionScale: userDecisionScale(dynasty.difficulty),
    cpuInterestScale: cpuRecruitingScale(dynasty.difficulty),
    teamName: (id: string) => formatTeamShort(teamMap.get(id) ?? id),
  };
  const recruitLandChances = view === 'recruiting' ? landChances(dynasty.recruits, landContext) : undefined;
  const selectedRecruitChance = selectedRecruit ? landChance(selectedRecruit, landContext) : undefined;

  // Once the user can't play again this postseason, the rest is one click.
  const userOutOfPostseason =
    !offseasonSummary && tournament !== null && tournament.phase !== 'complete' && !stillAlive(tournament, dynasty.userTeamId);
  const advance = (() => {
    if (offseasonSummary) {
      // A fired coach has to pick a new job first; that choice lives on the offseason screen.
      if (pendingJobOffers) {
        if (view === 'offseason') return null;
        return { label: 'Pick a Job', title: 'Pick your next job to start the new season', run: () => setView('offseason') };
      }
      // The offseason already rolled the dynasty over to next year's season.
      return { label: `Start Season ${dynasty.season.year}`, title: 'Start the new season', run: guardedStartSeason };
    }
    if (hasScheduledGames) {
      const week = dynasty.season.currentWeek;
      const game = dynasty.season.schedule.find(
        (g) => g.week === week && g.status === 'scheduled' && (g.homeTeamId === dynasty.userTeamId || g.awayTeamId === dynasty.userTeamId),
      );
      const opponentId = game ? (game.homeTeamId === dynasty.userTeamId ? game.awayTeamId : game.homeTeamId) : null;
      const matchup = opponentId
        ? ` ${game!.homeTeamId === dynasty.userTeamId ? 'vs' : 'at'} ${formatTeamShort(teamMap.get(opponentId) ?? opponentId)}`
        : ' (bye)';
      return { label: `Week ${week}${matchup}`, title: `Sim week ${week}: every game plays, recruiting moves, then the result`, run: simWeek };
    }
    if (!tournament) return { label: 'Start Postseason', title: 'Start the conference tournaments', run: enterTournament };
    const phaseActions = {
      conf_semis: { label: 'Conf Semis', title: 'Sim the conference semifinals', run: simTournamentSemis },
      conf_finals: { label: 'Conf Finals', title: 'Sim the conference finals, then the NCAA field is selected', run: simTournamentFinals },
      ncaa_first_round: { label: 'NCAA 1st Round', title: 'Sim the NCAA first round', run: simNcaaFirstRound },
      ncaa_quarterfinals: { label: 'NCAA Quarters', title: 'Sim the NCAA quarterfinals', run: simNcaaQuarterfinals },
      national_semis: { label: 'Final Four', title: 'Sim the national semifinals', run: simTournamentNationalSemis },
      national_final: { label: 'Title Game', title: 'Sim the national championship', run: simTournamentNational },
      complete: { label: 'Run Offseason', title: 'Run the offseason: graduation, development and signing day', run: enterOffseason },
    } as const;
    return phaseActions[tournament.phase];
  })();

  const openProgram = (teamId: string | null) => {
    setViewedProgramId(teamId);
    if (teamId) setView('programs');
  };

  type NavItem = { view: View; label: string; badge?: number | string; alert?: boolean };
  const navGroups: Array<{ title: string; items: NavItem[] }> = [
    {
      title: 'Office',
      items: [
        ...(offseasonSummary ? [{ view: 'offseason' as const, label: 'Offseason' }] : []),
        { view: 'week-hub', label: 'Week Hub', ...(highPriorityCount > 0 ? { badge: highPriorityCount, alert: true } : {}) },
        { view: 'season', label: 'Season' },
        { view: 'news', label: 'News', ...(unreadNewsCount > 0 ? { badge: unreadNewsCount } : {}) },
        { view: 'profile', label: 'Profile', ...(achievementToasts.length > 0 ? { badge: achievementToasts.length } : {}) },
      ],
    },
    {
      title: formatTeamName(userTeam.shortName || userTeam.name),
      items: [
        { view: 'team', label: 'Team' },
        { view: 'schedule', label: 'Schedule' },
        { view: 'staff', label: 'Staff' },
        { view: 'practice', label: 'Practice' },
        { view: 'locker-room', label: 'Locker Room', ...(unhappyCount > 0 ? { badge: unhappyCount } : {}) },
        { view: 'recruiting', label: committedCount > 0 ? `Recruiting · ${committedCount}` : 'Recruiting' },
      ],
    },
    {
      title: 'League',
      items: [
        { view: 'standings', label: 'Standings' },
        { view: 'programs', label: 'Programs' },
        { view: 'players', label: 'Player Search' },
        { view: 'stats', label: 'Stats' },
        ...(seasonComplete || tournament !== null
          ? [{ view: 'tournament' as const, label: 'Tournament', ...(tournament?.nationalChampion ? { badge: '✓' } : {}) }]
          : []),
        { view: 'history', label: 'History' },
        { view: 'records', label: 'Records' },
      ],
    },
  ];

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div className="brand">
          <p className="eyebrow">
            Men&apos;s College Lacrosse ·{' '}
            {offseasonSummary ? `${offseasonSummary.seasonYear} Offseason` : `Season ${dynasty.season.year}`}
          </p>
          <h1>Sports Management Sim</h1>
        </div>
        <section className="top-team" aria-label="User team summary">
          <strong className="top-team-name">{formatTeamName(userTeam.name)}</strong>
          <span className="top-record">
            <TickerNumber value={offseasonSummary ? offseasonSummary.userRecord.wins : userTeam.record.wins} />–
            <TickerNumber value={offseasonSummary ? offseasonSummary.userRecord.losses : userTeam.record.losses} />
          </span>
          {userRankEntry && (
            <span className="national-rank">
              #<TickerNumber value={userRankEntry.rank} /> Nationally
              <RankMove rank={userRankEntry.rank} />
            </span>
          )}
          <span className="top-phase">
            {offseasonSummary
              ? 'Offseason'
              : seasonComplete
              ? tournament?.phase === 'complete'
                ? 'Tournament Complete'
                : tournament
                  ? 'Conference Tournaments'
                  : 'Season Complete'
              : `Week ${dynasty.season.currentWeek}`}
          </span>
          {injuredCount > 0 && (
            <span className="injury-count">{injuredCount} injured</span>
          )}
        </section>
        <div className="top-actions save-actions" aria-label="Save controls">
          {advance && (
            <button type="button" className="advance-btn" title={advance.title} onClick={advance.run}>
              ▶ Continue: {advance.label}
            </button>
          )}
          {userOutOfPostseason && (
            <button
              type="button"
              className="advance-skip"
              title="You're out of the postseason: play the remaining rounds and go straight to the offseason"
              onClick={simToOffseason}
            >
              ⏭ Sim to Offseason
            </button>
          )}
          <button type="button" onClick={() => persistDynasty()}>
            Save Now
          </button>
          <button type="button" onClick={resetDynasty}>
            New Dynasty
          </button>
          <span className={saveError ? 'save-status save-status-failed' : 'save-status'} title={saveStatus}>
            {saveStatus}
          </span>
        </div>
      </header>
      {saveError && (
        <div className="save-error-banner" role="alert">
          <strong>{saveError}</strong>
          <span>Your latest progress is not saved yet. Autosave keeps trying after every change.</span>
          <button type="button" onClick={() => setScreen('start')}>
            Manage saves
          </button>
        </div>
      )}

      {confirmStart && startWarning && (
        <ConfirmModal
          title={`Start the ${dynasty.season.year} season now?`}
          message={startWarning}
          confirmLabel="Start anyway"
          cancelLabel="Not yet"
          onConfirm={() => {
            setConfirmStart(false);
            startNewSeason();
          }}
          onCancel={() => {
            setConfirmStart(false);
            setView('offseason');
          }}
        />
      )}

      {revealData && (
        <GameRevealModal
          reveal={revealData.reveal}
          userName={formatTeamName(userTeam.name)}
          opponentName={formatTeamName(teamMap.get(revealData.reveal.opponentId) ?? revealData.reveal.opponentId)}
          onBoxScore={revealData.boxScore ? () => setSelectedBoxScore(revealData.boxScore!) : undefined}
          onClose={dismissReveal}
        />
      )}

      {guideActive && !coachGuide.welcomed && (
        <WelcomeModal
          coachName={coachProfile?.name ?? 'Coach'}
          teamName={formatTeamName(userTeam.name)}
          onClose={acknowledgeWelcome}
        />
      )}

      {achievementToasts.length > 0 && view !== 'profile' && (
        <AchievementToast
          ids={achievementToasts}
          levelUp={levelUp}
          onView={() => {
            setView('profile');
            dismissAchievementToasts();
          }}
          onDismiss={dismissAchievementToasts}
        />
      )}

      <div className="shell-body">
        <aside className="side-nav">
          <nav aria-label="Main navigation">
            {navGroups.map((group) => (
              <div key={group.title} className="nav-group">
                <span className="nav-group-title">{group.title}</span>
                {group.items.map((item) => (
                  <button
                    key={item.view}
                    type="button"
                    className={view === item.view ? 'tab active' : 'tab'}
                    aria-current={view === item.view ? 'page' : undefined}
                    onClick={() => {
                      if (item.view === 'programs') setViewedProgramId(null);
                      setView(item.view);
                    }}
                  >
                    {item.label}
                    {item.badge !== undefined && (
                      <span className={item.alert ? 'tab-badge tab-badge-alert' : 'tab-badge'}>{item.badge}</span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          {coachProfile && (
            <div className="coach-block">
              <span className="coach-name">HC {coachProfile.name}</span>
              <button type="button" className="coach-title" onClick={() => setView('profile')} title="Open your profile">
                Lv {profileLevel(achievementPoints(profile.achievements)).level} · {profileTitle(profileLevel(achievementPoints(profile.achievements)).level)}
              </button>
              <span className="coach-tenure">
                Year {coachProfile.tenureSeasons + 1} · {coachProfile.contractYearsRemaining}yr left
                {dynasty.difficulty && dynasty.difficulty !== 'normal' && ` · ${DIFFICULTY_LABELS[dynasty.difficulty]}`}
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
        </aside>

        <section className="screen-area">
      {view === 'week-hub' && (
        <WeekHubScreen
          onCoachGame={canCoachGame ? () => setPregameOpen(true) : undefined}
          onRushInjury={rushInjuredPlayer}
          bracketStatus={ncaaProjection ? projectionStatus(ncaaProjection, dynasty.userTeamId) : undefined}
          guideCard={
            guideActive ? (
              <CoachChecklistCard
                steps={coachGuideSteps({
                  captainCount: teamCaptains(userTeam).length,
                  offersOut: dynasty.recruits.filter((r) => r.scholarshipOffers.some((o) => o.teamId === dynasty.userTeamId)).length,
                  gamesPlayed: userTeam.record.wins + userTeam.record.losses,
                  visited: coachGuide.visited,
                })}
                onNavigate={(v) => setView(v as Parameters<typeof setView>[0])}
                onDismiss={dismissCoachGuide}
              />
            ) : undefined
          }
          achievementCard={
            <AchievementWatchCard
              items={achievementWatch(achievementSnapshot, achievements, { rivalryWeek: !seasonComplete && Boolean(rivalryWeek) })}
              onOpenProfile={() => setView('profile')}
            />
          }
          formCard={<FormWatchCard roster={userTeam.roster} form={userForm} onSelectPlayer={setSelectedPlayerId} />}
          teamTalkCard={
            // Hidden at halftime: a talk given then would change a first half already shown.
            weeklyHub && !seasonComplete && !tournament && !halftime ? (
              <TeamTalkCard
                opponentName={formatTeamName(weeklyHub.opponentName)}
                talk={teamTalk}
                onTalk={(tone) =>
                  giveTeamTalk(tone, {
                    winProbability: weeklyHub.winProbability,
                    rivalry: rivalryForGame(rivalries, weeklyHub.preview.game) !== null,
                  })
                }
              />
            ) : undefined
          }
          currentWeek={dynasty.season.currentWeek}
          seasonComplete={seasonComplete}
          userTeam={userTeam}
          userRankEntry={userRankEntry ?? null}
          injuries={injuries.filter((inj) => inj.teamId === dynasty.userTeamId)}
          newsItems={newsItems}
          scouting={scouting}
          portalEntries={dynasty.portalEntries}
          recruitBoard={dynasty.recruitBoard}
          weeklyHub={weeklyHub}
          teamMap={teamMap}
          userTeamId={dynasty.userTeamId}
          lastSimWeek={lastSimWeek}
          lastWeekGames={lastWeekGames}
          rankOf={rankOf}
          gameLogs={gameLogs}
          onSimWeek={simWeek}
          offseason={Boolean(offseasonSummary)}
          onOpenOffseason={() => setView('offseason')}
          onBoxScore={setSelectedBoxScore}
          onNavigate={(v) => setView(v as Parameters<typeof setView>[0])}
          classNeeds={classNeedsByPosition(userTeam, dynasty.recruits, CLASS_NEED_POSITIONS)}
          vacantStaffRoles={vacantStaffRoles}
          openPlanSlots={Math.max(0, MAX_DEVELOPMENT_PLANS - practicePlan.developmentPlans.length)}
          unhappyCount={unhappyCount}
          redshirtSuggestions={redshirtSuggestions}
          captainCount={teamCaptains(userTeam).length}
          {...(rivalryWeek ? { rivalryWeek } : {})}
          previewCard={
            seasonPreview && seasonPreview.year === dynasty.season.year && lastSimWeek === null && !offseasonSummary ? (
              <SeasonPreviewCard
                preview={seasonPreview}
                conferences={dynasty.season.conferences}
                teamMap={teamMap}
                userTeamId={dynasty.userTeamId}
                onSelectPlayer={setSelectedPlayerId}
              />
            ) : pressConference ? (
              <PressConferenceCard press={pressConference} onAnswer={answerPressConference} />
            ) : null
          }
        />
      )}

      {view === 'season' && (
        <SeasonScreen
          onCoachGame={canCoachGame ? () => setPregameOpen(true) : undefined}
          currentWeek={dynasty.season.currentWeek}
          seasonComplete={seasonComplete}
          tournament={tournament}
          lastSimWeek={lastSimWeek}
          lastWeekGames={lastWeekGames}
          rankOf={rankOf}
          newsItems={newsItems}
          userTeam={userTeam}
          userInjuries={userInjuries}
          injuredCount={injuredCount}
          userTeamRating={userTeamRating}
          upcomingGames={upcomingGames}
          teamMap={teamMap}
          userTeamId={dynasty.userTeamId}
          gameLogs={gameLogs}
          gamePlan={gamePlan}
          trainingFocus={trainingFocus}
          nextOpponentScout={nextOpponentScout}
          weeklyHub={weeklyHub}
          onGamePlanChange={setGamePlan}
          autoGamePlan={autoGamePlan}
          onUseStaffPlan={restoreStaffGamePlan}
          onTrainingFocusChange={setTrainingFocus}
          onSimWeek={simWeek}
          onSimToEnd={simToEnd}
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
          gamePlan={gamePlan}
          onSelectPlayer={setSelectedPlayerId}
          onDepthChartChange={updateDepthChartSlot}
          onResetDepthChart={resetDepthChart}
          redshirts={{ open: redshirtsOpen, gamesPlayedFor, onSetRedshirt: setRedshirt }}
          form={userForm}
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
          rivalries={rivalries}
          rivalrySeries={rivalrySeries}
          conferences={dynasty.season.conferences}
          editable={scheduleEditable}
          onSwapNonConference={swapNonConferenceGame}
        />
      )}

      {view === 'recruiting' && (
        <RecruitingScreen
          classNeeds={classNeedsByPosition(userTeam, dynasty.recruits, CLASS_NEED_POSITIONS)}
          pipelines={recruitingPipelines(userTeam, dynasty.season.regions)}
          recruitBoard={dynasty.recruitBoard}
          portalEntries={dynasty.portalEntries}
          scouting={scouting}
          recruitingActivity={recruitingActivity}
          recruitTrends={recruitTrends}
          hasHomeGameThisWeek={hasHomeGameThisWeek}
          finalWeek={dynasty.season.schedule.reduce((max, g) => Math.max(max, g.week), 10)}
          userTeamId={dynasty.userTeamId}
          teamMap={teamMap}
          currentWeek={dynasty.season.currentWeek}
          recruitPosFilter={recruitPosFilter}
          recruitTab={recruitTab}
          shortlistIds={shortlistIds}
          boardView={recruitBoardView}
          scholarshipBudget={scholarshipBudget}
          onOfferScholarship={offerScholarship}
          onScoutRecruit={doScoutRecruit}
          onPitchRecruit={pitchRecruit}
          onToggleVisitInvite={toggleVisitInvite}
          onOfferPortalPlayer={offerPortalPlayer}
          onWithdrawPortalOffer={withdrawPortalOffer}
          nil={{ state: nil, onRetain: retainWithNil, onDeal: signNilDeal }}
          portalTeams={dynasty.season.teams}
          portalScholarshipRoom={portalScholarshipRoom}
          seasonYear={dynasty.season.year}
          onRecruitPosFilterChange={setRecruitPosFilter}
          onRecruitTabChange={setRecruitTab}
          onToggleShortlist={toggleShortlist}
          onBoardViewChange={setRecruitBoardView}
          onSelectRecruit={setSelectedRecruitId}
          assistantReport={assistantReport}
          autoAssistant={autoRecruitingAssistant}
          onRunAssistant={runRecruitingAssistant}
          onAutoAssistantChange={setAutoRecruitingAssistant}
          onMakeOffers={offerScholarships}
          autoOffers={autoRecruitingOffers}
          onAutoOffersChange={setAutoRecruitingOffers}
          landChances={recruitLandChances}
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
          onOpenProgram={openProgram}
          projection={ncaaProjection}
          powerRankings={
            dynasty.season.schedule.some((g) => g.status === 'final')
              ? powerRankingBlurbs(rankings, dynasty.season.schedule, (id) => formatTeamName(teamMap.get(id) ?? id), dynasty.season.currentWeek)
              : []
          }
        />
      )}

      {view === 'tournament' && (
        <TournamentScreen
          onCoachGame={canCoachGame ? () => setPregameOpen(true) : undefined}
          tournament={tournament}
          odds={ncaaBracketOdds}
          teamMap={teamMap}
          userTeamId={dynasty.userTeamId}
          seasonComplete={seasonComplete}
          onSimSemis={simTournamentSemis}
          onSimFinals={simTournamentFinals}
          onSimNcaaFirstRound={simNcaaFirstRound}
          onSimNcaaQuarterfinals={simNcaaQuarterfinals}
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
          season={dynasty.season}
          weeklyHonors={weeklyHonors}
          rivalries={rivalries}
        />
      )}

      {view === 'news' && (
        <NewsScreen newsItems={newsItems} userTeamName={userTeam?.shortName} />
      )}

      {view === 'staff' && (
        <StaffScreen
          staff={staff}
          coach={coachProfile}
          onUpgradeAbility={upgradeCoachAbility}
          candidates={staffCandidates}
          budget={staffBudget}
          onHire={hireStaff}
          onRelease={releaseStaff}
        />
      )}

      {view === 'practice' && userTeam && (
        <PracticeScreen
          team={userTeam}
          plan={practicePlan}
          gains={practiceGains}
          injuredIds={new Set(injuries.map((inj) => inj.playerId))}
          trainingFocus={trainingFocus}
          onIntensityChange={setPracticeIntensity}
          onSetPlan={setDevelopmentPlan}
          onRemovePlan={removeDevelopmentPlan}
          onAutoFill={autoFillDevelopmentPlans}
          onTrainingFocusChange={setTrainingFocus}
          onSelectPlayer={setSelectedPlayerId}
        />
      )}

      {view === 'locker-room' && userTeam && (
        <LockerRoomScreen
          team={userTeam}
          talkedIds={lockerRoom.talkedIds}
          canHoldMeeting={canHoldTeamMeeting}
          meetingReadyWeek={meetingReadyWeek}
          onTalk={talkToPlayer}
          onTeamMeeting={holdTeamMeeting}
          onSetCaptain={setTeamCaptain}
          promises={lockerRoom.promises ?? []}
          onPromise={promisePlayingTime}
          onSelectPlayer={setSelectedPlayerId}
        />
      )}

      {view === 'records' && (
        <RecordsScreen
          archive={recordBook}
          careers={careerStats}
          // After the offseason runs the year has rolled over; last season is already in the careers.
          seasonStats={offseasonSummary ? {} : seasonStats}
          teams={dynasty.season.teams}
          seasonYear={dynasty.season.year}
          userTeamName={userTeam.name}
          onSelectPlayer={setSelectedPlayerId}
        />
      )}

      {view === 'profile' && (
        <ProfileScreen
          profile={profile}
          dynastyAchievements={achievements}
          activeSaveId={activeSaveId}
          onSeen={dismissAchievementToasts}
          challenges={{ met: challengeLog.filter((c) => c.completed).length, faced: challengeLog.length }}
          snapshot={achievementSnapshot}
        />
      )}

      {view === 'history' && (
        <HistoryScreen
          history={dynastyHistory}
          hallOfFame={hallOfFame}
          coachName={coachProfile?.name ?? null}
          series={[...seriesByOpponent.values()]}
          teamName={(id) => formatTeamName(teamMap.get(id) ?? id)}
        />
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
          jobOffers={pendingJobOffers}
          coachName={coachProfile?.name ?? null}
          onAcceptJobOffer={acceptJobOffer}
          onStartNewSeason={guardedStartSeason}
          todos={todos ?? undefined}
          onOpenStaff={() => setView('staff')}
          onOfferPortalPlayer={offerPortalPlayer}
          portalTeams={dynasty.season.teams}
          portalScholarshipRoom={portalScholarshipRoom}
          onOpenPortal={() => { setRecruitTab('portal'); setView('recruiting'); }}
          investments={{ budget: investmentBudget, plan: investmentPlan, onFund: fundInvestment, onUnfund: unfundInvestment }}
          realignment={{ conferences: dynasty.season.conferences, teams: dynasty.season.teams, onAnswer: answerRealignmentInvite }}
          seasonReport={seasonReport(offseasonSummary.seasonYear, achievements, challengeLog)}
          onOpenProfile={() => setView('profile')}
        />
      )}

      {view === 'programs' && (
        <ProgramsScreen
          teams={dynasty.season.teams}
          conferences={dynasty.season.conferences}
          rankings={rankings}
          schedule={dynasty.season.schedule}
          seasonStats={seasonStats}
          userTeamId={dynasty.userTeamId}
          programId={viewedProgramId}
          onOpenProgram={openProgram}
          onSelectPlayer={setSelectedPlayerId}
          proDraftHistory={proDraftHistory}
          seriesFor={(id) => seriesByOpponent.get(id)}
          attendanceFor={(id) => seasonAttendance(dynasty.season.schedule, id)}
        />
      )}

      {view === 'players' && (
        <PlayersScreen
          teams={dynasty.season.teams}
          conferences={dynasty.season.conferences}
          seasonStats={seasonStats}
          userTeamId={dynasty.userTeamId}
          onSelectPlayer={setSelectedPlayerId}
          onOpenProgram={openProgram}
        />
      )}
        </section>
      </div>

      {selectedPlayer && (
        <PlayerPanel
          player={selectedPlayer}
          isInjured={userInjuries.has(selectedPlayer.id)}
          injuryData={injuries.find(
            (inj) => inj.playerId === selectedPlayer.id && inj.teamId === dynasty.userTeamId,
          )}
          onRushInjury={rushInjuredPlayer}
          // Last season is already in the career book during the offseason; don't count it twice.
          playerStats={offseasonSummary ? undefined : seasonStats[selectedPlayer.id]}
          career={careerStats[selectedPlayer.id]}
          seasonYear={dynasty.season.year}
          gameLog={playerGameLog(selectedPlayer.id, dynasty.season.schedule, gameLogs)}
          honors={playerHonors(dynastyHistory, selectedPlayer.id)}
          teamShort={(id) => formatTeamShort(teamMap.get(id) ?? id)}
          onClose={() => setSelectedPlayerId(null)}
        />
      )}

      {selectedRecruit && (
        <RecruitPanel
          recruit={selectedRecruit}
          scouting={scouting}
          userTeamId={dynasty.userTeamId}
          teamMap={teamMap}
          chance={selectedRecruitChance}
          onScout={doScoutRecruit}
          onClose={() => setSelectedRecruitId(null)}
        />
      )}

      {pregameOpen && canCoachGame && !halftime && (
        <PregameModal
          label={tournament ? TOURNAMENT_ROUND_LABELS[tournament.phase] : `Week ${dynasty.season.currentWeek}`}
          scout={pregameScout}
          gamePlan={gamePlan}
          onGamePlanChange={setGamePlan}
          autoGamePlan={autoGamePlan}
          onUseStaffPlan={restoreStaffGamePlan}
          onPlayFirstHalf={() => {
            setPregameOpen(false);
            coachGame();
          }}
          onCancel={() => setPregameOpen(false)}
        />
      )}

      {halftime && (
        <HalftimeModal
          log={halftime.log}
          label={halftime.tournamentPhase ? TOURNAMENT_ROUND_LABELS[halftime.tournamentPhase] : `Week ${halftime.week}`}
          userTeamId={dynasty.userTeamId}
          teamMap={teamMap}
          gamePlan={gamePlan}
          onPlaySecondHalf={playSecondHalf}
        />
      )}

      {selectedBoxScore && (
        <BoxScorePanel
          data={selectedBoxScore}
          onClose={() => setSelectedBoxScore(null)}
          playerName={(id) => playerLookup.get(id)?.name}
          playerPosition={(id) => playerLookup.get(id)?.position}
        />
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
