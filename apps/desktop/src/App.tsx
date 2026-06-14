import {
  calculateLacrosseTeamRating,
  deriveCpuGamePlan,
} from '@sports-management-sim/sport-lacrosse';
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
import { HistoryScreen } from './screens/HistoryScreen';
import { WeekHubScreen } from './screens/WeekHubScreen';
import { StartScreen } from './screens/StartScreen';
import { formatTeamName } from './ui/format';
import { useDynastyController } from './useDynastyController';
import './App.css';

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
  } = useDynastyController();

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
        <button
          className={view === 'week-hub' ? 'tab active' : 'tab'}
          onClick={() => setView('week-hub')}
        >
          Week Hub
          {highPriorityCount > 0 && (
            <span className="tab-badge tab-badge-alert">{highPriorityCount}</span>
          )}
        </button>
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
          shortlistIds={shortlistIds}
          boardView={recruitBoardView}
          scholarshipBudget={scholarshipBudget}
          onOfferScholarship={offerScholarship}
          onScoutRecruit={doScoutRecruit}
          onOfferPortalPlayer={offerPortalPlayer}
          onRecruitPosFilterChange={setRecruitPosFilter}
          onRecruitTabChange={setRecruitTab}
          onToggleShortlist={toggleShortlist}
          onBoardViewChange={setRecruitBoardView}
          onSelectRecruit={setSelectedRecruitId}
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
          jobOffers={pendingJobOffers}
          coachName={coachProfile?.name ?? null}
          onAcceptJobOffer={acceptJobOffer}
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
