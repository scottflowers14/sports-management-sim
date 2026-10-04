import {
  calculateLacrosseTeamRating,
  deriveCpuGamePlan,
  STAFF_ROLE_LABELS,
  MAX_DEVELOPMENT_PLANS,
  buildRivalries,
  rivalryFor,
  rivalryForGame,
  seriesSummary,
  suggestRedshirts,
  teamCaptains,
  STAFF_ROLES,
} from '@sports-management-sim/sport-lacrosse';
import type { StandingsEntry } from '@sports-management-sim/engine-core';
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
import { RecordsScreen } from './screens/RecordsScreen';
import { SeasonPreviewCard } from './components/SeasonPreviewCard';
import { WeekHubScreen } from './screens/WeekHubScreen';
import { StartScreen } from './screens/StartScreen';
import { ProgramsScreen } from './screens/ProgramsScreen';
import { PlayersScreen } from './screens/PlayersScreen';
import { useState } from 'react';
import { formatTeamName } from './ui/format';
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
    setAutoRecruitingOffers,
    hasHomeGameThisWeek,
    offerPortalPlayer,
    withdrawPortalOffer,
    portalScholarshipRoom,
    nil,
    retainWithNil,
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
  } = useDynastyController();
  const [viewedProgramId, setViewedProgramId] = useState<string | null>(null);

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

  const committedCount = dynasty.recruits.filter(
    (r) => r.committedTeamId === dynasty.userTeamId || r.signedTeamId === dynasty.userTeamId,
  ).length;

  const userRankEntry = rankings.find((r) => r.teamId === dynasty.userTeamId);
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
  const rivalries = buildRivalries(dynasty.season.conferences, dynasty.season.teams);
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
  const nextOpponentScout = nextUserGame && nextOpponentTeam
    ? {
        week: nextUserGame.week,
        name: formatTeamName(nextOpponentTeam.name),
        isHome: nextUserGame.homeTeamId === dynasty.userTeamId,
        plan: deriveCpuGamePlan(nextOpponentTeam),
        rating: calculateLacrosseTeamRating(nextOpponentTeam).overall,
      }
    : null;

  const weeklyHub = buildWeeklyHub({
    schedule: dynasty.season.schedule,
    teams: dynasty.season.teams,
    userTeamId: dynasty.userTeamId,
    currentWeek: dynasty.season.currentWeek,
    rankings,
    seasonStats,
  });

  // Player cards are reusable across the whole league, not just the user roster.
  const selectedPlayer = selectedPlayerId
    ? dynasty.season.teams.flatMap((t) => t.roster).find((p) => p.id === selectedPlayerId)
    : null;
  const selectedRecruit = selectedRecruitId ? dynasty.recruits.find((r) => r.id === selectedRecruitId) : null;

  const advance = (() => {
    if (offseasonSummary) {
      if (view !== 'offseason') {
        return { label: 'Offseason', title: 'Finish the offseason to start the new season', run: () => setView('offseason') };
      }
      // A fired coach has to pick a new job first; that choice lives on the offseason screen.
      if (pendingJobOffers) return null;
      // The offseason already rolled the dynasty over to next year's season.
      return { label: `Season ${dynasty.season.year}`, title: 'Start the new season', run: startNewSeason };
    }
    if (hasScheduledGames) {
      return { label: `Week ${dynasty.season.currentWeek}`, title: `Sim week ${dynasty.season.currentWeek}`, run: simWeek };
    }
    if (!tournament) return { label: 'Postseason', title: 'Start the conference tournaments', run: enterTournament };
    const phaseActions = {
      conf_semis: { label: 'Conf Semis', title: 'Sim the conference semifinals', run: simTournamentSemis },
      conf_finals: { label: 'Conf Finals', title: 'Sim the conference finals, then the NCAA field is selected', run: simTournamentFinals },
      ncaa_first_round: { label: 'NCAA 1st Round', title: 'Sim the NCAA first round', run: simNcaaFirstRound },
      ncaa_quarterfinals: { label: 'NCAA Quarters', title: 'Sim the NCAA quarterfinals', run: simNcaaQuarterfinals },
      national_semis: { label: 'Final Four', title: 'Sim the national semifinals', run: simTournamentNationalSemis },
      national_final: { label: 'Title Game', title: 'Sim the national championship', run: simTournamentNational },
      complete: { label: 'Offseason', title: 'Run the offseason: graduation, development and signing day', run: enterOffseason },
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
            {offseasonSummary
              ? `${offseasonSummary.userRecord.wins}–${offseasonSummary.userRecord.losses}`
              : `${userTeam.record.wins}–${userTeam.record.losses}`}
          </span>
          {userRankEntry && (
            <span className="national-rank">#{userRankEntry.rank} Nationally</span>
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
              ▶ Advance: {advance.label}
            </button>
          )}
          <button type="button" onClick={() => persistDynasty()}>
            Save Now
          </button>
          <button type="button" onClick={resetDynasty}>
            New Dynasty
          </button>
          <span>{saveStatus}</span>
        </div>
      </header>

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
        </aside>

        <section className="screen-area">
      {view === 'week-hub' && (
        <WeekHubScreen
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
          gameLogs={gameLogs}
          onSimWeek={simWeek}
          onBoxScore={setSelectedBoxScore}
          onNavigate={(v) => setView(v as Parameters<typeof setView>[0])}
          classNeeds={classNeedsByPosition(userTeam, dynasty.recruits, CLASS_NEED_POSITIONS)}
          vacantStaffRoles={STAFF_ROLES.filter((role) => !staff[role]).map((role) => STAFF_ROLE_LABELS[role].title.toLowerCase())}
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
            ) : null
          }
        />
      )}

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
          gamePlan={gamePlan}
          trainingFocus={trainingFocus}
          nextOpponentScout={nextOpponentScout}
          weeklyHub={weeklyHub}
          onGamePlanChange={setGamePlan}
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

      {view === 'history' && (
        <HistoryScreen history={dynastyHistory} hallOfFame={hallOfFame} coachName={coachProfile?.name ?? null} />
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
          onStartNewSeason={startNewSeason}
          onOfferPortalPlayer={offerPortalPlayer}
          portalTeams={dynasty.season.teams}
          portalScholarshipRoom={portalScholarshipRoom}
          onOpenPortal={() => { setRecruitTab('portal'); setView('recruiting'); }}
          investments={{ budget: investmentBudget, plan: investmentPlan, onFund: fundInvestment, onUnfund: unfundInvestment }}
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
          playerStats={seasonStats[selectedPlayer.id]}
          career={careerStats[selectedPlayer.id]}
          seasonYear={dynasty.season.year}
          onClose={() => setSelectedPlayerId(null)}
        />
      )}

      {selectedRecruit && (
        <RecruitPanel
          recruit={selectedRecruit}
          scouting={scouting}
          userTeamId={dynasty.userTeamId}
          teamMap={teamMap}
          onScout={doScoutRecruit}
          onClose={() => setSelectedRecruitId(null)}
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
