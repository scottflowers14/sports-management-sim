import { useState, useCallback, useRef, useEffect } from 'react';
import {
  advanceSeasonWeek,
  applyScholarshipOffer,
  sortRecruitBoardForTeam,
} from '@sports-management-sim/engine-core';
import {
  calculateLacrosseTeamRating,
  createNewLacrosseDynasty,
  offerLacrossePortalPlayer,
  simulateLacrosseGame,
  updateLacrosseDepthChartSlot,
} from '@sports-management-sim/sport-lacrosse';
import type { LacrosseDynastyState, LacrossePortalEntry, LacrossePosition } from '@sports-management-sim/sport-lacrosse';
import { autoCommitWeekly, runOffseason, processInjuries, resolveAndApplyPortal } from './dynasty-helpers';
import type { OffseasonSummary, InjuredPlayer } from './dynasty-helpers';
import { computeNationalRankings } from './rankings';
import type { RankingEntry } from './rankings';
import { generateWeeklyNews, generateRecruitingNews } from './news-feed';
import type { NewsItem } from './news-feed';
import type { SeasonAwards } from './awards';
import {
  initTournament,
  advanceTournamentSemis,
  advanceTournamentFinals,
  advanceNationalChampionship,
} from './tournament';
import type { TournamentState, TournamentGame, ConferenceBracket } from './tournament';
import type { DynastySeasonRecord } from './history';
import {
  createScoutingState,
  advanceScoutingWeek,
  scoutRecruit as scoutRecruitFn,
  resetScoutingForNewClass,
  getDisplayOvr,
  getScoutTier,
} from './scouting';
import type { ScoutingState } from './scouting';
import { emptySeasonStats, updateSeasonStats } from './stats';
import type { SeasonStatsMap, PlayerSeasonStats } from './stats';
import { DepthChart } from './components/DepthChart';
import { ResultRow } from './components/ResultRow';
import { BoxScorePanel } from './components/BoxScorePanel';
import { TeamScreen } from './screens/TeamScreen';
import { ScheduleScreen } from './screens/ScheduleScreen';
import { formatTeamName, formatTeamShort } from './ui/format';
import type { BoxScoreData } from './ui/types';
import { clearDynastyState, loadDynastyState, saveDynastyState } from './persistence';
import './App.css';

const initialDynasty = createNewLacrosseDynasty({
  seed: 2028,
  userTeamId: 'maryland-state',
  seasonYear: 2028,
});

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
  const [loadedSave] = useState(() => loadDynastyState());
  const [dynasty, setDynasty] = useState<LacrosseDynastyState>(loadedSave?.dynasty ?? initialDynasty);
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
  const [scouting, setScouting] = useState<ScoutingState>(() => loadedSave?.scouting ?? createScoutingState(3));
  const [seasonStats, setSeasonStats] = useState<SeasonStatsMap>(() => loadedSave?.seasonStats ?? emptySeasonStats());
  const [saveStatus, setSaveStatus] = useState(() => (loadedSave ? 'Loaded local save' : 'Autosave ready'));
  const [recruitPosFilter, setRecruitPosFilter] = useState<LacrossePosition | 'ALL'>('ALL');
  const [recruitTab, setRecruitTab] = useState<'board' | 'portal'>('board');

  const rankingsRef = useRef<RankingEntry[]>(rankings);
  rankingsRef.current = rankings;
  const injuriesRef = useRef<InjuredPlayer[]>(injuries);
  injuriesRef.current = injuries;

  const persistDynasty = useCallback((status = 'Saved locally') => {
    saveDynastyState({
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
    });
    setSaveStatus(status);
  }, [dynasty, lastSimWeek, offseasonSummary, rankings, newsItems, tournament, dynastyHistory, injuries, scouting, seasonStats]);

  useEffect(() => {
    const timeout = window.setTimeout(() => persistDynasty('Autosaved'), 300);
    return () => window.clearTimeout(timeout);
  }, [persistDynasty]);

  const resetDynasty = useCallback(() => {
    clearDynastyState();
    setDynasty(initialDynasty);
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
    setScouting(createScoutingState(3));
    setSeasonStats(emptySeasonStats());
    setSaveStatus('New dynasty started');
  }, []);

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
      const newSeason = advanceSeasonWeek(prev.season, (_game, homeTeam, awayTeam) =>
        simulateLacrosseGame({ homeTeam, awayTeam }),
      );
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

      // Capture for async updates
      const newSeasonSnap = newSeason;

      setTimeout(() => {
        setRankings(newRanks);
        setInjuries(newInjuries);
        setScouting((s) => advanceScoutingWeek(s));
        setSeasonStats((prev) => updateSeasonStats(prev, newSeasonSnap.schedule, newSeasonSnap.teams, weekToSim));
        setNewsItems((prevNews) => [...weekNews, ...recruitNews, ...injuryNews, ...prevNews].slice(0, 60));
        setLastSimWeek(weekToSim);
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
    setTournament(initTournament(dynasty.season.standings));
    setView('tournament');
  }, [dynasty.season.standings]);

  const simTournamentSemis = useCallback(() => {
    setTournament((prev) => prev ? advanceTournamentSemis(prev, dynasty.season.teams) : prev);
  }, [dynasty.season.teams]);

  const simTournamentFinals = useCallback(() => {
    setTournament((prev) => prev ? advanceTournamentFinals(prev, dynasty.season.teams) : prev);
  }, [dynasty.season.teams]);

  const simTournamentNational = useCallback(() => {
    setTournament((prev) => prev ? advanceNationalChampionship(prev, dynasty.season.teams) : prev);
  }, [dynasty.season.teams]);

  const enterOffseason = useCallback(() => {
    const tournamentChampion = tournament?.nationalChampion;
    const userConfId = dynasty.season.teams.find((t) => t.id === dynasty.userTeamId)?.conferenceId;
    const userBracket = userConfId === 'acc' ? tournament?.accBracket : tournament?.necBracket;
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

    setView('offseason');
  }, [tournament, dynasty.userTeamId, dynasty.season.teams, dynasty.season.standings, dynasty.season.conferences, rankings]);

  const startNewSeason = useCallback(() => {
    setDynasty((prev) => resolveAndApplyPortal(prev));
    setOffseasonSummary(null);
    setNewsItems([]);
    setLastSimWeek(null);
    setRankings([]);
    setTournament(null);
    setInjuries([]);
    setSelectedPlayerId(null);
    setSelectedBoxScore(null);
    setSeasonStats(emptySeasonStats());
    setScouting((s) => resetScoutingForNewClass(s));
    setView('season');
  }, []);

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

  // Player lookup map for stat views
  const playerLookup = buildPlayerLookup(dynasty.season.teams);

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
        <div className="season-layout">
          <div className="season-main">
            <article className="card">
              <h2>This Week</h2>
              {!seasonComplete ? (
                <button className="sim-btn" onClick={simWeek}>
                  Sim Week {dynasty.season.currentWeek}
                </button>
              ) : !tournament ? (
                <button className="tournament-btn" onClick={enterTournament}>
                  Enter Conference Tournaments →
                </button>
              ) : tournament.phase !== 'complete' ? (
                <button className="tournament-btn" onClick={() => setView('tournament')}>
                  View Tournament Bracket →
                </button>
              ) : (
                <button className="offseason-btn" onClick={enterOffseason}>
                  Enter Offseason →
                </button>
              )}
              {lastWeekGames.length > 0 && (
                <div className="results-block">
                  <p className="section-label">Week {lastSimWeek} Results</p>
                  <ul className="result-list">
                    {lastWeekGames.map((game) => (
                      <ResultRow
                        key={game.id}
                        game={game}
                        teamMap={teamMap}
                        userTeamId={dynasty.userTeamId}
                        onBoxScore={setSelectedBoxScore}
                      />
                    ))}
                  </ul>
                </div>
              )}
            </article>

            {newsItems.length > 0 && (
              <article className="card">
                <h2>Latest News</h2>
                <ul className="news-list">
                  {newsItems.slice(0, 6).map((item) => (
                    <li key={item.id} className="news-item">
                      <span className={`news-chip chip-${item.category}`}>{item.category}</span>
                      <div>
                        <p className="news-headline">{item.headline}</p>
                        <p className="news-week">Wk {item.week}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            )}
          </div>

          <div className="season-sidebar">
            <article className="card">
              <h2>Roster</h2>
              <p className="metric">{userTeam.roster.length} players</p>
              <p className="sub-metric">
                {userTeam.resources.scholarshipUsed.toFixed(1)} /{' '}
                {userTeam.resources.scholarshipLimit.toFixed(1)} scholarships
                {injuredCount > 0 && <span className="sidebar-inj"> · {injuredCount} inj</span>}
              </p>
              <div className="team-rating-summary" aria-label="Team rating summary">
                <div className="team-rating-overall">
                  <span className="team-rating-number">{userTeamRating.overall}</span>
                  <span className="team-rating-label">Team OVR</span>
                </div>
                <div className="team-rating-breakdown">
                  <span>OFF {userTeamRating.offense}</span>
                  <span>DEF {userTeamRating.defense}</span>
                  <span>GK {userTeamRating.goalie}</span>
                  <span>FO {userTeamRating.faceoff}</span>
                </div>
              </div>
              <DepthChart team={userTeam} injuries={userInjuries} />
              <ul className="player-roster-list">
                {userTeam.roster.map((p) => {
                  const isInjured = userInjuries.has(p.id);
                  return (
                    <li
                      key={p.id}
                      className={`player-roster-row${isInjured ? ' player-injured' : ''}`}
                      onClick={() => setSelectedPlayerId(p.id)}
                    >
                      <span className="player-row-name">
                        {p.name.first} {p.name.last}
                        {isInjured && <span className="inj-badge">INJ</span>}
                      </span>
                      <span className="player-row-meta">{p.position} · {p.classYear}</span>
                      <span className="player-row-ovr">{p.ratings.overall}</span>
                    </li>
                  );
                })}
              </ul>
            </article>

            <article className="card">
              <h2>Upcoming</h2>
              {upcomingGames.length > 0 ? (
                <ol>
                  {upcomingGames.map((game) => (
                    <li key={game.id}>
                      <strong>Wk {game.week}</strong>
                      <span>
                        {formatTeamName(teamMap.get(game.awayTeamId) ?? game.awayTeamId)} at{' '}
                        {formatTeamName(teamMap.get(game.homeTeamId) ?? game.homeTeamId)}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="dim">Season complete — check standings</p>
              )}
            </article>
          </div>
        </div>
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
          onBoxScore={setSelectedBoxScore}
        />
      )}

      {view === 'recruiting' && (
        <div className="recruit-layout">
          <div className="recruit-top-bar">
            <div className="recruit-tabs">
              <button
                className={`recruit-tab${recruitTab === 'board' ? ' active' : ''}`}
                onClick={() => setRecruitTab('board')}
              >
                Recruit Board
              </button>
              <button
                className={`recruit-tab${recruitTab === 'portal' ? ' active' : ''}`}
                onClick={() => setRecruitTab('portal')}
              >
                Transfer Portal
                {dynasty.portalEntries.filter((e) => e.status === 'available').length > 0 && (
                  <span className="portal-badge">
                    {dynasty.portalEntries.filter((e) => e.status === 'available').length}
                  </span>
                )}
              </button>
            </div>

            {recruitTab === 'board' && (
              <div className="scout-header-inline">
                <span className="scout-pts-num">{scouting.pointsAvailable}</span>
                <span className="scout-pts-label">Scouting Points</span>
                <span className="scout-pts-hint">(+{scouting.pointsPerWeek}/wk)</span>
              </div>
            )}
          </div>

          {recruitTab === 'board' && (
            <>
              <div className="pos-filter-bar">
                {(['ALL', 'ATT', 'MID', 'DEF', 'GK', 'FOGO', 'LSM'] as const).map((pos) => (
                  <button
                    key={pos}
                    className={`pos-filter-btn${recruitPosFilter === pos ? ' active' : ''}`}
                    onClick={() => setRecruitPosFilter(pos)}
                  >
                    {pos}
                  </button>
                ))}
              </div>

              <div className="recruit-grid">
                {dynasty.recruitBoard
                  .filter((e) => recruitPosFilter === 'ALL' || e.recruit.position === recruitPosFilter)
                  .slice(0, 30)
                  .map((entry) => {
                    const { recruit } = entry;
                    const tier = getScoutTier(recruit.id, scouting);
                    const displayOvr = getDisplayOvr(recruit.id, recruit.ratings.overall, scouting);
                    const userInterest = recruit.interestByTeamId[dynasty.userTeamId] ?? 0;
                    const hasOffer = recruit.scholarshipOffers.some((o) => o.teamId === dynasty.userTeamId);
                    const isCommittedToUs =
                      recruit.committedTeamId === dynasty.userTeamId ||
                      recruit.signedTeamId === dynasty.userTeamId;
                    const isCommittedElsewhere = recruit.status !== 'open' && !isCommittedToUs;

                    // Competing teams: other teams with offers, sorted by their interest level
                    const competitors = recruit.scholarshipOffers
                      .filter((o) => o.teamId !== dynasty.userTeamId)
                      .map((o) => ({
                        teamId: o.teamId,
                        name: formatTeamShort(teamMap.get(o.teamId) ?? o.teamId),
                        interest: recruit.interestByTeamId[o.teamId] ?? 0,
                      }))
                      .sort((a, b) => b.interest - a.interest)
                      .slice(0, 3);

                    // Commit probability for offered recruits (0–100)
                    const commitThreshold = Math.min(84, Math.max(58, 84 - dynasty.season.currentWeek * 5 + recruit.starRating));
                    const commitPct = hasOffer ? Math.min(100, Math.round((userInterest / commitThreshold) * 100)) : 0;

                    return (
                      <article
                        key={recruit.id}
                        className={`card recruit-card${isCommittedToUs ? ' committed-to-us' : ''}${tier === 'none' ? ' unscouted' : ''}`}
                      >
                        <div className="recruit-header">
                          <div>
                            <strong>
                              {recruit.name.first} {recruit.name.last}
                            </strong>
                            <p className="recruit-sub">
                              {recruit.position} ·{' '}
                              {tier !== 'none' ? (
                                <>
                                  {'★'.repeat(recruit.starRating)}{'☆'.repeat(5 - recruit.starRating)}
                                </>
                              ) : (
                                <span className="hidden-stat">? stars</span>
                              )}
                            </p>
                          </div>
                          <div className="recruit-ovr-block">
                            {displayOvr !== null ? (
                              <span className={`board-score${tier === 'partial' ? ' fuzzy-ovr' : ''}`}>
                                {displayOvr}
                                {tier === 'partial' && <span className="fuzzy-tilde">~</span>}
                              </span>
                            ) : (
                              <span className="board-score hidden-stat">??</span>
                            )}
                            <span className="recruit-score-label">OVR</span>
                          </div>
                        </div>

                        {tier !== 'none' && hasOffer && (
                          <>
                            <div className="interest-bar-wrap">
                              <div className="interest-bar" style={{ width: `${userInterest}%` }} />
                            </div>
                            <div className="recruit-interest-row">
                              <span className="interest-label">Interest {userInterest}/100</span>
                              <span className={`commit-pct${commitPct >= 80 ? ' hot' : commitPct >= 50 ? ' warm' : ''}`}>
                                {commitPct}% commit
                              </span>
                            </div>
                          </>
                        )}

                        {competitors.length > 0 && !isCommittedToUs && !isCommittedElsewhere && (
                          <div className="competitor-row">
                            {competitors.map((c) => (
                              <span key={c.teamId} className="competitor-chip" title={`${c.name} — ${c.interest} interest`}>
                                {c.name}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="recruit-footer">
                          {isCommittedToUs ? (
                            <span className={`badge badge-${recruit.status}`}>
                              {recruit.status === 'committed' ? 'Committed' : 'Signed'}
                            </span>
                          ) : isCommittedElsewhere ? (
                            <span className="badge badge-elsewhere">
                              → {formatTeamName(teamMap.get(recruit.committedTeamId ?? recruit.signedTeamId ?? '') ?? 'Other')}
                            </span>
                          ) : tier === 'none' ? (
                            <button
                              className="scout-btn"
                              onClick={() => doScoutRecruit(recruit.id, recruit.ratings.overall)}
                              disabled={scouting.pointsAvailable <= 0}
                            >
                              Scout (1 pt)
                            </button>
                          ) : tier === 'partial' ? (
                            <div className="recruit-footer-row">
                              <button
                                className="scout-btn scout-btn-sm"
                                onClick={() => doScoutRecruit(recruit.id, recruit.ratings.overall)}
                                disabled={scouting.pointsAvailable <= 0}
                              >
                                Full Scout (1 pt)
                              </button>
                              {!hasOffer && (
                                <button className="offer-btn" onClick={() => offerScholarship(recruit.id)}>
                                  Offer
                                </button>
                              )}
                              {hasOffer && <span className="badge badge-offered">Offered</span>}
                            </div>
                          ) : hasOffer ? (
                            <span className="badge badge-offered">Offered</span>
                          ) : (
                            <button className="offer-btn" onClick={() => offerScholarship(recruit.id)}>
                              Offer Scholarship
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
              </div>
            </>
          )}

          {recruitTab === 'portal' && (
            <PortalBoard
              entries={dynasty.portalEntries}
              userTeamId={dynasty.userTeamId}
              teamMap={teamMap}
              onOffer={offerPortalPlayer}
            />
          )}
        </div>
      )}

      {view === 'standings' && (
        <div className="standings-layout">
          <article className="card">
            <h2>National Rankings</h2>
            {rankings.length > 0 ? (
              <table className="standings-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th></th>
                    <th>Team</th>
                    <th>W</th>
                    <th>L</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((entry) => {
                    const change = entry.previousRank - entry.rank;
                    const team = dynasty.season.teams.find((t) => t.id === entry.teamId);
                    const standing = sortedStandings.find((s) => s.teamId === entry.teamId);
                    return (
                      <tr
                        key={entry.teamId}
                        className={entry.teamId === dynasty.userTeamId ? 'user-row' : ''}
                      >
                        <td className="rank">#{entry.rank}</td>
                        <td>
                          {change > 0 ? (
                            <span className="rank-change rank-up">▲{change}</span>
                          ) : change < 0 ? (
                            <span className="rank-change rank-down">▼{Math.abs(change)}</span>
                          ) : (
                            <span className="rank-change rank-same">—</span>
                          )}
                        </td>
                        <td>
                          {formatTeamName(teamMap.get(entry.teamId) ?? entry.teamId)}
                          {team && (
                            <span className="prestige-pip" title={`Prestige ${team.reputation.nationalPrestige}`}>
                              {' '}
                              <span className="prestige-dots">
                                {'●'.repeat(Math.ceil(team.reputation.nationalPrestige / 20)).slice(0, 5)}
                              </span>
                            </span>
                          )}
                        </td>
                        <td>{standing?.record.wins ?? 0}</td>
                        <td>{standing?.record.losses ?? 0}</td>
                        <td>{entry.score}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="dim">Sim some games to see rankings</p>
            )}
          </article>

          <div className="conf-group">
            {(['acc', 'nec'] as const).map((confId) => {
              const confLabel = confId.toUpperCase();
              const confStandings = sortedStandings.filter((s) => {
                const team = dynasty.season.teams.find((t) => t.id === s.teamId);
                return team?.conferenceId === confId;
              });
              if (confStandings.length === 0) return null;
              return (
                <article key={confId} className="card">
                  <h2>{confLabel} Standings</h2>
                  <table className="standings-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>Team</th>
                        <th>W</th>
                        <th>L</th>
                        <th>Conf W–L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {confStandings.map((entry, i) => (
                        <tr
                          key={entry.teamId}
                          className={entry.teamId === dynasty.userTeamId ? 'user-row' : ''}
                        >
                          <td className="rank">#{i + 1}</td>
                          <td>{formatTeamName(teamMap.get(entry.teamId) ?? entry.teamId)}</td>
                          <td>{entry.record.wins}</td>
                          <td>{entry.record.losses}</td>
                          <td>{entry.record.conferenceWins}–{entry.record.conferenceLosses}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {view === 'tournament' && (
        <TournamentView
          tournament={tournament}
          teamMap={teamMap}
          userTeamId={dynasty.userTeamId}
          onSimSemis={simTournamentSemis}
          onSimFinals={simTournamentFinals}
          onSimNational={simTournamentNational}
          onEnterOffseason={enterOffseason}
          onInitTournament={enterTournament}
          seasonComplete={seasonComplete}
          onBoxScore={setSelectedBoxScore}
        />
      )}

      {view === 'stats' && (
        <StatsView
          seasonStats={seasonStats}
          playerLookup={playerLookup}
          userTeamId={dynasty.userTeamId}
        />
      )}

      {view === 'news' && (
        <article className="card">
          <h2>News Feed</h2>
          {newsItems.length > 0 ? (
            <ul className="news-list">
              {newsItems.map((item) => (
                <li key={item.id} className="news-item">
                  <span className={`news-chip chip-${item.category}`}>{item.category}</span>
                  <div>
                    <p className="news-headline">{item.headline}</p>
                    <p className="news-week">Wk {item.week}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dim">No news yet — sim some games to generate news</p>
          )}
        </article>
      )}

      {view === 'history' && (
        <HistoryView history={dynastyHistory} />
      )}

      {view === 'offseason' && offseasonSummary && (
        <div className="offseason-layout">
          <div className="offseason-left">
            <article className="card season-recap-card">
              <p className="eyebrow">{offseasonSummary.seasonYear} Season Recap</p>
              <h2>
                Finished #{offseasonSummary.userStanding} ·{' '}
                {offseasonSummary.userRecord.wins}–{offseasonSummary.userRecord.losses}
              </h2>
              <table className="standings-table recap-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Team</th>
                    <th>W</th>
                    <th>L</th>
                  </tr>
                </thead>
                <tbody>
                  {offseasonSummary.finalStandings.map((entry, i) => (
                    <tr
                      key={entry.teamId}
                      className={entry.teamId === dynasty.userTeamId ? 'user-row' : ''}
                    >
                      <td className="rank">#{i + 1}</td>
                      <td>{formatTeamName(teamMap.get(entry.teamId) ?? entry.teamId)}</td>
                      <td>{entry.record.wins}</td>
                      <td>{entry.record.losses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>

            {offseasonSummary.awards && (
              <AwardsSection awards={offseasonSummary.awards} />
            )}
          </div>

          <div className="offseason-right">
            {dynastyHistory.length > 0 && (
              <article className="card prestige-card">
                <h2>Program Prestige</h2>
                <PrestigeSection reputation={userTeam.reputation} />
              </article>
            )}

            <article className="card">
              <h2>Graduating Seniors</h2>
              {offseasonSummary.graduates.length > 0 ? (
                <ul className="player-list">
                  {offseasonSummary.graduates.map((p, i) => (
                    <li key={i}>
                      <strong>{p.name}</strong>
                      <span>{p.position} · {p.overall} OVR</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dim">No graduating seniors</p>
              )}
            </article>

            <article className="card">
              <h2>Signing Class · {dynasty.season.year - 1}</h2>
              {offseasonSummary.signingClass.length > 0 ? (
                <ul className="player-list">
                  {offseasonSummary.signingClass.map((p, i) => (
                    <li key={i}>
                      <strong>{p.name}</strong>
                      <span>{p.position} · {'★'.repeat(p.starRating)} · {p.overall} OVR</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dim">No signed recruits</p>
              )}
            </article>

            {dynasty.portalEntries.length > 0 && (
              <article className="card portal-offseason-card">
                <h2>Transfer Portal · {dynasty.portalEntries.filter((e) => e.status === 'available').length} Available</h2>
                <p className="portal-hint">Make offers before starting the season. Portal resolves when you begin.</p>
                <div className="portal-mini-list">
                  {dynasty.portalEntries
                    .filter((e) => e.status === 'available')
                    .slice(0, 8)
                    .map((entry) => {
                      const hasOffer = entry.offersByTeamId[dynasty.userTeamId] !== undefined;
                      return (
                        <div key={entry.id} className="portal-mini-row">
                          <span className="portal-mini-name">
                            {entry.name.first} {entry.name.last}
                          </span>
                          <span className="portal-mini-meta">
                            {entry.classYear} {entry.position} · {entry.ratings.overall} OVR
                          </span>
                          {hasOffer ? (
                            <span className="badge badge-offered">Offered</span>
                          ) : (
                            <button className="offer-btn offer-btn-sm" onClick={() => offerPortalPlayer(entry.id)}>
                              Offer
                            </button>
                          )}
                        </div>
                      );
                    })}
                  {dynasty.portalEntries.filter((e) => e.status === 'available').length > 8 && (
                    <p className="dim">+{dynasty.portalEntries.filter((e) => e.status === 'available').length - 8} more in portal</p>
                  )}
                </div>
              </article>
            )}

            <button className="sim-btn new-season-btn" onClick={startNewSeason}>
              Start {dynasty.season.year} Season →
            </button>
          </div>
        </div>
      )}

      {selectedPlayerId && (() => {
        const player = userTeam.roster.find((p) => p.id === selectedPlayerId);
        if (!player) return null;
        const isInjured = userInjuries.has(player.id);
        const injuryData = injuries.find(
          (inj) => inj.playerId === player.id && inj.teamId === dynasty.userTeamId,
        );
        const playerStats = seasonStats[player.id];
        return (
          <div className="player-panel-backdrop" onClick={() => setSelectedPlayerId(null)}>
            <aside className="player-panel card" onClick={(e) => e.stopPropagation()}>
              <button
                className="panel-close"
                onClick={() => setSelectedPlayerId(null)}
                aria-label="Close player panel"
              >×</button>
              <div>
                <p className="panel-name">
                  {player.name.first} {player.name.last}
                  {isInjured && <span className="inj-badge inj-badge-lg">INJ</span>}
                </p>
                <p className="panel-meta">{player.position} · {player.classYear} · {player.hometown}</p>
                {isInjured && injuryData && (
                  <p className="injury-status">
                    Out {injuryData.weeksRemaining} more week{injuryData.weeksRemaining > 1 ? 's' : ''}
                  </p>
                )}
              </div>
              <div className="ovr-block">
                <div className="ovr-stat">
                  <div className="ovr-num">{player.ratings.overall}</div>
                  <div className="ovr-label">Overall</div>
                </div>
                <div className="ovr-stat">
                  <div className="ovr-num">{player.ratings.potential}</div>
                  <div className="ovr-label">Potential</div>
                </div>
              </div>
              <div>
                {(
                  [
                    ['Athleticism', player.ratings.athleticism],
                    ['Speed', player.ratings.speed],
                    ['Strength', player.ratings.strength],
                    ['Skill', player.ratings.skill],
                    ['IQ', player.ratings.iq],
                    ['Work Ethic', player.ratings.workEthic],
                  ] as [string, number][]
                ).map(([label, value]) => (
                  <div key={label} className="rating-row">
                    <span>{label}</span>
                    <div className="rating-bar-wrap">
                      <div className="rating-bar-fill" style={{ width: `${value}%` }} />
                    </div>
                    <span className="rating-val">{value}</span>
                  </div>
                ))}
              </div>
              {player.traits.length > 0 && (
                <div className="trait-list">
                  {player.traits.map((trait) => (
                    <span key={trait} className="trait-chip">{trait.replace(/_/g, ' ')}</span>
                  ))}
                </div>
              )}
              {playerStats && playerStats.gamesPlayed > 0 && (
                <PlayerStatsSection stats={playerStats} position={player.position} />
              )}
            </aside>
          </div>
        );
      })()}

      {selectedBoxScore && (
        <BoxScorePanel data={selectedBoxScore} onClose={() => setSelectedBoxScore(null)} />
      )}
    </main>
  );
}

// ── Portal Board ───────────────────────────────────────────────────────────────

function PortalBoard({
  entries,
  userTeamId,
  teamMap,
  onOffer,
}: {
  entries: LacrossePortalEntry[];
  userTeamId: string;
  teamMap: Map<string, string>;
  onOffer: (id: string) => void;
}) {
  const available = entries.filter((e) => e.status === 'available');
  const committed = entries.filter((e) => e.status === 'committed' && e.committedTeamId === userTeamId);

  if (entries.length === 0) {
    return (
      <article className="card">
        <h2>Transfer Portal</h2>
        <p className="dim">Portal opens at the start of each new season. Check back after the offseason.</p>
      </article>
    );
  }

  return (
    <div className="portal-layout">
      {committed.length > 0 && (
        <article className="card portal-committed-card">
          <h2>Committed Transfers · {committed.length}</h2>
          <ul className="player-list">
            {committed.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.name.first} {entry.name.last}</strong>
                <span>{entry.classYear} {entry.position} · {entry.ratings.overall} OVR · from {formatTeamName(teamMap.get(entry.sourceTeamId) ?? entry.sourceTeamId)}</span>
              </li>
            ))}
          </ul>
        </article>
      )}

      <div className="recruit-grid">
        {available.map((entry) => {
          const hasOffer = entry.offersByTeamId[userTeamId] !== undefined;
          const userInterest = entry.interestByTeamId[userTeamId] ?? 0;
          const competitors = Object.entries(entry.offersByTeamId)
            .filter(([tid]) => tid !== userTeamId)
            .map(([tid]) => ({ teamId: tid, name: formatTeamShort(teamMap.get(tid) ?? tid) }))
            .slice(0, 3);

          return (
            <article key={entry.id} className={`card recruit-card portal-entry-card${hasOffer ? ' has-offer' : ''}`}>
              <div className="recruit-header">
                <div>
                  <strong>{entry.name.first} {entry.name.last}</strong>
                  <p className="recruit-sub">{entry.classYear} {entry.position} · from {formatTeamShort(teamMap.get(entry.sourceTeamId) ?? entry.sourceTeamId)}</p>
                </div>
                <div className="recruit-ovr-block">
                  <span className="board-score">{entry.ratings.overall}</span>
                  <span className="recruit-score-label">OVR</span>
                </div>
              </div>

              {hasOffer && userInterest > 0 && (
                <>
                  <div className="interest-bar-wrap">
                    <div className="interest-bar" style={{ width: `${userInterest}%` }} />
                  </div>
                  <p className="interest-label">Interest {userInterest}/100</p>
                </>
              )}

              {competitors.length > 0 && (
                <div className="competitor-row">
                  {competitors.map((c) => (
                    <span key={c.teamId} className="competitor-chip">{c.name}</span>
                  ))}
                </div>
              )}

              <div className="recruit-footer">
                {hasOffer ? (
                  <span className="badge badge-offered">Offered</span>
                ) : (
                  <button className="offer-btn" onClick={() => onOffer(entry.id)}>
                    Offer Scholarship
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

// ── Stats View ─────────────────────────────────────────────────────────────────

type StatCategory = 'scoring' | 'goalkeeping' | 'faceoffs' | 'defense';

function StatsView({
  seasonStats,
  playerLookup,
  userTeamId,
}: {
  seasonStats: SeasonStatsMap;
  playerLookup: Map<string, { name: string; teamName: string; position: string; teamId: string }>;
  userTeamId: string;
}) {
  const [category, setCategory] = useState<StatCategory>('scoring');

  const allStats = Object.values(seasonStats).filter((s) => s.gamesPlayed > 0);

  if (allStats.length === 0) {
    return (
      <article className="card">
        <h2>Season Stats</h2>
        <p className="dim">Sim some games to populate stat leaders.</p>
      </article>
    );
  }

  const categories: StatCategory[] = ['scoring', 'goalkeeping', 'faceoffs', 'defense'];

  return (
    <div className="stats-layout">
      <div className="stats-cat-bar">
        {categories.map((cat) => (
          <button
            key={cat}
            className={category === cat ? 'stat-cat-btn active' : 'stat-cat-btn'}
            onClick={() => setCategory(cat)}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {category === 'scoring' && (
        <StatTable
          title="Scoring Leaders"
          rows={allStats
            .filter((s) => {
              const info = playerLookup.get(s.playerId);
              return info?.position === 'ATT' || info?.position === 'MID';
            })
            .sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists))
            .slice(0, 15)}
          columns={[
            { label: 'G', key: 'goals' },
            { label: 'A', key: 'assists' },
            { label: 'PTS', compute: (s) => s.goals + s.assists },
            { label: 'SH', key: 'shots' },
            { label: 'GP', key: 'gamesPlayed' },
          ]}
          playerLookup={playerLookup}
          userTeamId={userTeamId}
        />
      )}

      {category === 'goalkeeping' && (
        <StatTable
          title="Goalkeeping Leaders"
          rows={allStats
            .filter((s) => {
              const info = playerLookup.get(s.playerId);
              return info?.position === 'GK';
            })
            .sort((a, b) => b.saves - a.saves)
            .slice(0, 10)}
          columns={[
            { label: 'SV', key: 'saves' },
            { label: 'GA', key: 'goalsAllowed' },
            { label: 'SV%', compute: (s) => s.saves + s.goalsAllowed > 0 ? Math.round(s.saves / (s.saves + s.goalsAllowed) * 100) : 0 },
            { label: 'GP', key: 'gamesPlayed' },
          ]}
          playerLookup={playerLookup}
          userTeamId={userTeamId}
        />
      )}

      {category === 'faceoffs' && (
        <StatTable
          title="Faceoff Leaders"
          rows={allStats
            .filter((s) => s.faceoffAttempts > 0)
            .sort((a, b) => b.faceoffWins - a.faceoffWins)
            .slice(0, 10)}
          columns={[
            { label: 'FW', key: 'faceoffWins' },
            { label: 'FA', key: 'faceoffAttempts' },
            { label: 'FO%', compute: (s) => s.faceoffAttempts > 0 ? Math.round(s.faceoffWins / s.faceoffAttempts * 100) : 0 },
            { label: 'GP', key: 'gamesPlayed' },
          ]}
          playerLookup={playerLookup}
          userTeamId={userTeamId}
        />
      )}

      {category === 'defense' && (
        <StatTable
          title="Defensive Leaders"
          rows={allStats
            .filter((s) => {
              const info = playerLookup.get(s.playerId);
              return info?.position === 'DEF' || info?.position === 'LSM';
            })
            .sort((a, b) => (b.causedTurnovers + b.groundBalls) - (a.causedTurnovers + a.groundBalls))
            .slice(0, 15)}
          columns={[
            { label: 'CT', key: 'causedTurnovers' },
            { label: 'GB', key: 'groundBalls' },
            { label: 'TO', key: 'turnovers' },
            { label: 'GP', key: 'gamesPlayed' },
          ]}
          playerLookup={playerLookup}
          userTeamId={userTeamId}
        />
      )}
    </div>
  );
}

type StatColumn =
  | { label: string; key: keyof PlayerSeasonStats }
  | { label: string; compute: (s: PlayerSeasonStats) => number };

function StatTable({
  title,
  rows,
  columns,
  playerLookup,
  userTeamId,
}: {
  title: string;
  rows: PlayerSeasonStats[];
  columns: StatColumn[];
  playerLookup: Map<string, { name: string; teamName: string; position: string; teamId: string }>;
  userTeamId: string;
}) {
  if (rows.length === 0) {
    return (
      <article className="card">
        <h2>{title}</h2>
        <p className="dim">No data yet</p>
      </article>
    );
  }

  return (
    <article className="card">
      <h2>{title}</h2>
      <table className="standings-table stats-table">
        <thead>
          <tr>
            <th></th>
            <th>Player</th>
            <th>Team</th>
            {columns.map((col) => <th key={col.label}>{col.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const info = playerLookup.get(row.playerId);
            const isUser = info?.teamId === userTeamId;
            return (
              <tr key={row.playerId} className={isUser ? 'user-row' : ''}>
                <td className="rank">#{i + 1}</td>
                <td>{info?.name ?? '—'}</td>
                <td className="stats-team">{info ? formatTeamShort(info.teamName) : '—'}</td>
                {columns.map((col) => (
                  <td key={col.label} className="stat-val">
                    {'key' in col
                      ? String(row[col.key])
                      : String(col.compute(row))}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </article>
  );
}

// ── Player stats in panel ──────────────────────────────────────────────────────

function PlayerStatsSection({ stats, position }: { stats: PlayerSeasonStats; position: string }) {
  const isGk = position === 'GK';
  const isFogo = position === 'FOGO';
  const isOff = position === 'ATT' || position === 'MID';
  const isDef = position === 'DEF' || position === 'LSM';

  return (
    <div className="player-stats-section">
      <p className="section-label">{new Date().getFullYear()} Season · {stats.gamesPlayed} GP</p>
      <div className="player-stats-grid">
        {isGk && (
          <>
            <StatChip label="SV" value={stats.saves} />
            <StatChip label="GA" value={stats.goalsAllowed} />
            <StatChip label="SV%" value={stats.saves + stats.goalsAllowed > 0 ? Math.round(stats.saves / (stats.saves + stats.goalsAllowed) * 100) : 0} unit="%" />
          </>
        )}
        {isFogo && (
          <>
            <StatChip label="FW" value={stats.faceoffWins} />
            <StatChip label="FA" value={stats.faceoffAttempts} />
            <StatChip label="FO%" value={stats.faceoffAttempts > 0 ? Math.round(stats.faceoffWins / stats.faceoffAttempts * 100) : 0} unit="%" />
          </>
        )}
        {isOff && (
          <>
            <StatChip label="G" value={stats.goals} />
            <StatChip label="A" value={stats.assists} />
            <StatChip label="PTS" value={stats.goals + stats.assists} />
            <StatChip label="SH" value={stats.shots} />
          </>
        )}
        {isDef && (
          <StatChip label="CT" value={stats.causedTurnovers} />
        )}
        {!isGk && !isFogo && (
          <StatChip label="GB" value={stats.groundBalls} />
        )}
      </div>
    </div>
  );
}

function StatChip({ label, value, unit = '' }: { label: string; value: number; unit?: string }) {
  return (
    <div className="stat-chip">
      <div className="stat-chip-num">{value}{unit}</div>
      <div className="stat-chip-label">{label}</div>
    </div>
  );
}

// ── Tournament View ────────────────────────────────────────────────────────────

function TournamentView({
  tournament,
  teamMap,
  userTeamId,
  onSimSemis,
  onSimFinals,
  onSimNational,
  onEnterOffseason,
  onInitTournament,
  seasonComplete,
  onBoxScore,
}: {
  tournament: TournamentState | null;
  teamMap: Map<string, string>;
  userTeamId: string;
  onSimSemis: () => void;
  onSimFinals: () => void;
  onSimNational: () => void;
  onEnterOffseason: () => void;
  onInitTournament: () => void;
  seasonComplete: boolean;
  onBoxScore: (data: BoxScoreData) => void;
}) {
  if (!tournament) {
    return (
      <article className="card">
        <h2>Conference Tournaments</h2>
        {seasonComplete ? (
          <>
            <p className="dim">Regular season is complete. Begin the conference tournaments.</p>
            <button className="tournament-btn" style={{ marginTop: 16 }} onClick={onInitTournament}>
              Start Conference Tournaments →
            </button>
          </>
        ) : (
          <p className="dim">Complete the regular season to unlock the conference tournaments.</p>
        )}
      </article>
    );
  }

  return (
    <div className="tournament-layout">
      <div className="tournament-conferences">
        <ConferenceBracketCard
          bracket={tournament.accBracket}
          confLabel="ACC"
          teamMap={teamMap}
          userTeamId={userTeamId}
          onBoxScore={onBoxScore}
        />
        <ConferenceBracketCard
          bracket={tournament.necBracket}
          confLabel="NEC"
          teamMap={teamMap}
          userTeamId={userTeamId}
          onBoxScore={onBoxScore}
        />
      </div>

      {(tournament.phase === 'national' || tournament.phase === 'complete') && tournament.nationalGame && (
        <article className="card national-champ-card">
          <h2>National Championship</h2>
          <BracketMatchup
            game={tournament.nationalGame}
            seeds={[]}
            teamMap={teamMap}
            userTeamId={userTeamId}
            onBoxScore={onBoxScore}
            title="National Championship"
          />
          {tournament.nationalChampion && (
            <div className="national-champion-banner">
              <span className="champion-label">National Champion</span>
              <span className="champion-name champion-name-lg">
                {formatTeamName(teamMap.get(tournament.nationalChampion) ?? tournament.nationalChampion)}
              </span>
            </div>
          )}
        </article>
      )}

      <div className="tournament-controls">
        {tournament.phase === 'semis' && (
          <button className="sim-btn" onClick={onSimSemis}>Sim Conference Semifinals</button>
        )}
        {tournament.phase === 'finals' && (
          <button className="sim-btn" onClick={onSimFinals}>Sim Conference Finals</button>
        )}
        {tournament.phase === 'national' && (
          <button className="sim-btn" onClick={onSimNational}>Sim National Championship</button>
        )}
        {tournament.phase === 'complete' && (
          <button className="offseason-btn" onClick={onEnterOffseason}>Enter Offseason →</button>
        )}
      </div>
    </div>
  );
}

function ConferenceBracketCard({
  bracket,
  confLabel,
  teamMap,
  userTeamId,
  onBoxScore,
}: {
  bracket: ConferenceBracket;
  confLabel: string;
  teamMap: Map<string, string>;
  userTeamId: string;
  onBoxScore: (data: BoxScoreData) => void;
}) {
  return (
    <article className="card">
      <h2>{confLabel} Tournament</h2>
      <div className="bracket">
        <div className="bracket-semis">
          <p className="section-label">Semifinals</p>
          <BracketMatchup
            game={bracket.semifinal1}
            seeds={bracket.seeds}
            teamMap={teamMap}
            userTeamId={userTeamId}
            onBoxScore={onBoxScore}
            title={`${confLabel} Semifinal 1`}
          />
          <BracketMatchup
            game={bracket.semifinal2}
            seeds={bracket.seeds}
            teamMap={teamMap}
            userTeamId={userTeamId}
            onBoxScore={onBoxScore}
            title={`${confLabel} Semifinal 2`}
          />
        </div>
        <div className="bracket-connector">→</div>
        <div className="bracket-final-col">
          <p className="section-label">Championship</p>
          {bracket.final ? (
            <BracketMatchup
              game={bracket.final}
              seeds={bracket.seeds}
              teamMap={teamMap}
              userTeamId={userTeamId}
              onBoxScore={onBoxScore}
              title={`${confLabel} Championship`}
            />
          ) : (
            <div className="bracket-tbd">
              <div className="bracket-team tbd-team"><span>TBD</span></div>
              <div className="bracket-vs">vs</div>
              <div className="bracket-team tbd-team"><span>TBD</span></div>
            </div>
          )}
          {bracket.champion && (
            <div className="champion-display">
              <span className="champion-label">{confLabel} Champion</span>
              <span className="champion-name">
                {formatTeamName(teamMap.get(bracket.champion) ?? bracket.champion)}
              </span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function BracketMatchup({
  game,
  seeds,
  teamMap,
  userTeamId,
  onBoxScore,
  title,
}: {
  game: TournamentGame;
  seeds: string[];
  teamMap: Map<string, string>;
  userTeamId: string;
  onBoxScore: (data: BoxScoreData) => void;
  title: string;
}) {
  const { result } = game;
  const homeScore = result
    ? result.winnerId === game.homeTeamId ? result.winnerScore : result.loserScore
    : null;
  const awayScore = result
    ? result.winnerId === game.awayTeamId ? result.winnerScore : result.loserScore
    : null;
  const homeWon = result?.winnerId === game.homeTeamId;
  const awayWon = result?.winnerId === game.awayTeamId;
  const homeSeed = seeds.indexOf(game.homeTeamId) + 1;
  const awaySeed = seeds.indexOf(game.awayTeamId) + 1;

  const handleClick = () => {
    if (!result?.teamStats) return;
    onBoxScore({
      title,
      homeTeamName: teamMap.get(game.homeTeamId) ?? game.homeTeamId,
      awayTeamName: teamMap.get(game.awayTeamId) ?? game.awayTeamId,
      homeScore: homeScore!,
      awayScore: awayScore!,
      overtime: result.overtime,
      homeStats: result.teamStats.home,
      awayStats: result.teamStats.away,
    });
  };

  return (
    <div
      className={`bracket-matchup${result ? ' played' : ''}`}
      onClick={result?.teamStats ? handleClick : undefined}
      style={{ cursor: result?.teamStats ? 'pointer' : 'default' }}
    >
      <div className={`bracket-team${homeWon ? ' winner' : result ? ' loser' : ''}`}>
        {homeSeed > 0 && <span className="bracket-seed">#{homeSeed}</span>}
        <span className={`bracket-team-name${game.homeTeamId === userTeamId ? ' user' : ''}`}>
          {formatTeamName(teamMap.get(game.homeTeamId) ?? game.homeTeamId)}
        </span>
        {homeScore !== null && (
          <span className={`bracket-score${homeWon ? ' score-win' : ''}`}>{homeScore}</span>
        )}
      </div>
      <div className="bracket-vs">vs</div>
      <div className={`bracket-team${awayWon ? ' winner' : result ? ' loser' : ''}`}>
        {awaySeed > 0 && <span className="bracket-seed">#{awaySeed}</span>}
        <span className={`bracket-team-name${game.awayTeamId === userTeamId ? ' user' : ''}`}>
          {formatTeamName(teamMap.get(game.awayTeamId) ?? game.awayTeamId)}
        </span>
        {awayScore !== null && (
          <span className={`bracket-score${awayWon ? ' score-win' : ''}`}>{awayScore}</span>
        )}
      </div>
      {result?.overtime && <span className="ot-badge">OT</span>}
    </div>
  );
}

// ── History View ───────────────────────────────────────────────────────────────

function HistoryView({ history }: { history: DynastySeasonRecord[] }) {
  if (history.length === 0) {
    return (
      <article className="card">
        <h2>Dynasty History</h2>
        <p className="dim">Complete your first season to start building the dynasty record.</p>
      </article>
    );
  }

  const totalWins = history.reduce((sum, r) => sum + r.wins, 0);
  const totalLosses = history.reduce((sum, r) => sum + r.losses, 0);
  const confTitles = history.filter((r) => r.confChampion).length;
  const natTitles = history.filter((r) => r.nationalChampion).length;

  return (
    <div className="history-layout">
      <div className="history-summary-row">
        <article className="card history-stat-card">
          <p className="history-stat-num">{totalWins}–{totalLosses}</p>
          <p className="history-stat-label">All-Time Record</p>
        </article>
        <article className="card history-stat-card">
          <p className="history-stat-num">{confTitles}</p>
          <p className="history-stat-label">Conf. Titles</p>
        </article>
        <article className="card history-stat-card">
          <p className="history-stat-num">{natTitles}</p>
          <p className="history-stat-label">Nat. Championships</p>
        </article>
        <article className="card history-stat-card">
          <p className="history-stat-num">{history.length}</p>
          <p className="history-stat-label">Seasons</p>
        </article>
      </div>

      <article className="card">
        <h2>Season Log</h2>
        <table className="standings-table history-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>Record</th>
              <th>Conf</th>
              <th>Nat Rank</th>
              <th>Conf</th>
              <th>Natl</th>
              <th>Class</th>
            </tr>
          </thead>
          <tbody>
            {history.map((record) => (
              <tr key={record.year}>
                <td className="rank">{record.year}</td>
                <td className="record-cell">{record.wins}–{record.losses}</td>
                <td>#{record.confStanding}</td>
                <td>{record.natRankAtEnd !== null ? `#${record.natRankAtEnd}` : '—'}</td>
                <td>{record.confChampion ? <span className="champ-badge conf-champ">CHAMP</span> : '—'}</td>
                <td>{record.nationalChampion ? <span className="champ-badge natl-champ">CHAMP</span> : '—'}</td>
                <td>{record.signingClassSize}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </div>
  );
}

// ── Awards Section ─────────────────────────────────────────────────────────────

function AwardsSection({ awards }: { awards: SeasonAwards }) {
  return (
    <article className="card">
      <h2>Season Awards</h2>
      <div className="awards-grid">
        {[
          { label: 'MVP', winner: awards.mvp },
          { label: 'Offensive Player', winner: awards.offensivePlayer },
          { label: 'Defensive Player', winner: awards.defensivePlayer },
          ...(awards.freshmanOfYear ? [{ label: 'Freshman of Year', winner: awards.freshmanOfYear }] : []),
        ].map(({ label, winner }) => (
          <div key={label} className="award-item">
            <div className="award-label">{label}</div>
            <div className="award-player">{winner.playerName}</div>
            <div className="award-detail">
              {winner.position} · {formatTeamName(winner.teamName)} · {winner.overall} OVR
            </div>
          </div>
        ))}
      </div>
      {awards.allConference.length > 0 && (
        <>
          <p className="section-label">All-Conference</p>
          <table className="standings-table">
            <thead>
              <tr>
                <th>Player</th><th>Pos</th><th>Team</th><th>OVR</th>
              </tr>
            </thead>
            <tbody>
              {awards.allConference.map((winner, i) => (
                <tr key={i}>
                  <td>{winner.playerName}</td>
                  <td>{winner.position}</td>
                  <td>{formatTeamName(winner.teamName)}</td>
                  <td>{winner.overall}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </article>
  );
}

// ── Prestige Section ───────────────────────────────────────────────────────────

function PrestigeSection({ reputation }: {
  reputation: {
    nationalPrestige: number;
    coachingPrestige: number;
    facilities: number;
    fanSupport: number;
    recentSuccess: number;
  };
}) {
  const bars: [string, number][] = [
    ['National Prestige', reputation.nationalPrestige],
    ['Coaching', reputation.coachingPrestige],
    ['Facilities', reputation.facilities],
    ['Fan Support', reputation.fanSupport],
    ['Recent Success', reputation.recentSuccess],
  ];
  return (
    <div className="prestige-bars">
      {bars.map(([label, val]) => (
        <div key={label} className="rating-row">
          <span>{label}</span>
          <div className="rating-bar-wrap">
            <div className="rating-bar-fill" style={{ width: `${val}%` }} />
          </div>
          <span className="rating-val">{val}</span>
        </div>
      ))}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

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
