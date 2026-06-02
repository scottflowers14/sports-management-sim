import { useState, useCallback, useRef } from 'react';
import {
  advanceSeasonWeek,
  applyScholarshipOffer,
  sortRecruitBoardForTeam,
} from '@sports-management-sim/engine-core';
import type { ScheduledGame } from '@sports-management-sim/engine-core';
import { createNewLacrosseDynasty, simulateLacrosseGame } from '@sports-management-sim/sport-lacrosse';
import type { LacrosseDynastyState } from '@sports-management-sim/sport-lacrosse';
import { autoCommitWeekly, runOffseason } from './dynasty-helpers';
import type { OffseasonSummary } from './dynasty-helpers';
import { computeNationalRankings } from './rankings';
import type { RankingEntry } from './rankings';
import { generateWeeklyNews, generateRecruitingNews } from './news-feed';
import type { NewsItem } from './news-feed';
import type { SeasonAwards } from './awards';
import './App.css';

const initialDynasty = createNewLacrosseDynasty({
  seed: 2028,
  userTeamId: 'maryland-state',
  seasonYear: 2028,
});

type View = 'season' | 'recruiting' | 'standings' | 'offseason' | 'news';

export function App() {
  const [dynasty, setDynasty] = useState<LacrosseDynastyState>(initialDynasty);
  const [view, setView] = useState<View>('season');
  const [lastSimWeek, setLastSimWeek] = useState<number | null>(null);
  const [offseasonSummary, setOffseasonSummary] = useState<OffseasonSummary | null>(null);
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // Keep a ref to rankings so we can read it inside setDynasty without stale closure issues
  const rankingsRef = useRef<RankingEntry[]>(rankings);
  rankingsRef.current = rankings;

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
      const newRecruits = autoCommitWeekly(prev.recruits, newSeason.teams, Math.random);
      const updatedUserTeam = newSeason.teams.find((t) => t.id === prev.userTeamId)!;
      const newBoard = sortRecruitBoardForTeam(updatedUserTeam, newRecruits, prev.rosterTargets);
      const newDynasty = { ...prev, season: newSeason, recruits: newRecruits, recruitBoard: newBoard };

      const currentRankings = rankingsRef.current;
      const newRanks = computeNationalRankings(newSeason.teams, currentRankings);
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

      setTimeout(() => {
        setRankings(newRanks);
        setNewsItems((prevNews) => [...weekNews, ...recruitNews, ...prevNews].slice(0, 50));
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

  const enterOffseason = useCallback(() => {
    setDynasty((prev) => {
      const { newDynasty, summary } = runOffseason(prev);
      setOffseasonSummary(summary);
      return newDynasty;
    });
    setView('offseason');
  }, []);

  const startNewSeason = useCallback(() => {
    setOffseasonSummary(null);
    setNewsItems([]);
    setLastSimWeek(null);
    setRankings([]);
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
          <span>{seasonComplete ? 'Season Complete' : `Week ${dynasty.season.currentWeek}`}</span>
          <span className="record-big">
            {userTeam.record.wins}–{userTeam.record.losses}
          </span>
          {userRankEntry && (
            <span className="national-rank">#{userRankEntry.rank} Nationally</span>
          )}
        </section>
      </header>

      <nav className="tab-bar" aria-label="Main navigation">
        {(['season', 'recruiting', 'standings'] as const).map((v) => (
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
        <button
          className={view === 'news' ? 'tab active' : 'tab'}
          onClick={() => setView('news')}
        >
          News
          {unreadNewsCount > 0 && (
            <span className="tab-badge">{unreadNewsCount}</span>
          )}
        </button>
        {view === 'offseason' && (
          <button className="tab active">Offseason</button>
        )}
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
                      <span className={`news-chip chip-${item.category}`}>
                        {item.category}
                      </span>
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
              </p>
              <ul className="position-grid">
                {Object.entries(dynasty.rosterTargets).map(([pos, target]) => {
                  const current = userTeam.roster.filter((p) => p.position === pos).length;
                  const ok = current >= (target ?? 0);
                  return (
                    <li key={pos} className={ok ? 'pos-ok' : 'pos-need'}>
                      <span className="pos-label">{pos}</span>
                      <span>{current}/{target}</span>
                    </li>
                  );
                })}
              </ul>
              <ul className="player-roster-list">
                {userTeam.roster.map((p) => (
                  <li
                    key={p.id}
                    className="player-roster-row"
                    onClick={() => setSelectedPlayerId(p.id)}
                  >
                    <span className="player-row-name">
                      {p.name.first} {p.name.last}
                    </span>
                    <span className="player-row-meta">
                      {p.position} · {p.classYear}
                    </span>
                    <span className="player-row-ovr">{p.ratings.overall}</span>
                  </li>
                ))}
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

      {view === 'recruiting' && (
        <div className="recruit-grid">
          {dynasty.recruitBoard.slice(0, 24).map((entry) => {
            const { recruit } = entry;
            const interest = recruit.interestByTeamId[dynasty.userTeamId] ?? 0;
            const hasOffer = recruit.scholarshipOffers.some((o) => o.teamId === dynasty.userTeamId);
            const isCommittedToUs =
              recruit.committedTeamId === dynasty.userTeamId ||
              recruit.signedTeamId === dynasty.userTeamId;
            const isCommittedElsewhere = recruit.status !== 'open' && !isCommittedToUs;

            return (
              <article
                key={recruit.id}
                className={`card recruit-card${isCommittedToUs ? ' committed-to-us' : ''}`}
              >
                <div className="recruit-header">
                  <div>
                    <strong>
                      {recruit.name.first} {recruit.name.last}
                    </strong>
                    <p className="recruit-sub">
                      {recruit.position} · {'★'.repeat(recruit.starRating)}
                      {'☆'.repeat(5 - recruit.starRating)}
                    </p>
                  </div>
                  <span className="board-score">{entry.score}</span>
                </div>

                <div className="interest-bar-wrap">
                  <div className="interest-bar" style={{ width: `${interest}%` }} />
                </div>
                <p className="interest-label">Interest {interest}/100</p>

                <div className="recruit-footer">
                  {isCommittedToUs ? (
                    <span className={`badge badge-${recruit.status}`}>
                      {recruit.status === 'committed' ? 'Committed' : 'Signed'}
                    </span>
                  ) : isCommittedElsewhere ? (
                    <span className="badge badge-elsewhere">
                      →{' '}
                      {formatTeamName(
                        teamMap.get(
                          recruit.committedTeamId ?? recruit.signedTeamId ?? '',
                        ) ?? 'Other',
                      )}
                    </span>
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
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((entry) => {
                    const change = entry.previousRank - entry.rank;
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
                        <td>{formatTeamName(teamMap.get(entry.teamId) ?? entry.teamId)}</td>
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
                          <td>
                            {formatTeamName(teamMap.get(entry.teamId) ?? entry.teamId)}
                          </td>
                          <td>{entry.record.wins}</td>
                          <td>{entry.record.losses}</td>
                          <td>
                            {entry.record.conferenceWins}–{entry.record.conferenceLosses}
                          </td>
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
            <article className="card">
              <h2>Graduating Seniors</h2>
              {offseasonSummary.graduates.length > 0 ? (
                <ul className="player-list">
                  {offseasonSummary.graduates.map((p, i) => (
                    <li key={i}>
                      <strong>{p.name}</strong>
                      <span>
                        {p.position} · {p.overall} OVR
                      </span>
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
                      <span>
                        {p.position} · {'★'.repeat(p.starRating)} · {p.overall} OVR
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dim">No signed recruits</p>
              )}
            </article>

            <button className="sim-btn new-season-btn" onClick={startNewSeason}>
              Start {dynasty.season.year} Season →
            </button>
          </div>
        </div>
      )}

      {selectedPlayerId &&
        (() => {
          const player = userTeam.roster.find((p) => p.id === selectedPlayerId);
          if (!player) return null;
          return (
            <div
              className="player-panel-backdrop"
              onClick={() => setSelectedPlayerId(null)}
            >
              <aside className="player-panel card" onClick={(e) => e.stopPropagation()}>
                <button
                  className="panel-close"
                  onClick={() => setSelectedPlayerId(null)}
                  aria-label="Close player panel"
                >
                  ×
                </button>
                <div>
                  <p className="panel-name">
                    {player.name.first} {player.name.last}
                  </p>
                  <p className="panel-meta">
                    {player.position} · {player.classYear} · {player.hometown}
                  </p>
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
                        <div
                          className="rating-bar-fill"
                          style={{ width: `${value}%` }}
                        />
                      </div>
                      <span className="rating-val">{value}</span>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          );
        })()}
    </main>
  );
}

function AwardsSection({ awards }: { awards: SeasonAwards }) {
  return (
    <article className="card">
      <h2>Season Awards</h2>
      <div className="awards-grid">
        <div className="award-item">
          <div className="award-label">MVP</div>
          <div className="award-player">{awards.mvp.playerName}</div>
          <div className="award-detail">
            {awards.mvp.position} · {formatTeamName(awards.mvp.teamName)} · {awards.mvp.overall} OVR
          </div>
        </div>
        <div className="award-item">
          <div className="award-label">Offensive Player</div>
          <div className="award-player">{awards.offensivePlayer.playerName}</div>
          <div className="award-detail">
            {awards.offensivePlayer.position} · {formatTeamName(awards.offensivePlayer.teamName)} ·{' '}
            {awards.offensivePlayer.overall} OVR
          </div>
        </div>
        <div className="award-item">
          <div className="award-label">Defensive Player</div>
          <div className="award-player">{awards.defensivePlayer.playerName}</div>
          <div className="award-detail">
            {awards.defensivePlayer.position} · {formatTeamName(awards.defensivePlayer.teamName)} ·{' '}
            {awards.defensivePlayer.overall} OVR
          </div>
        </div>
        {awards.freshmanOfYear && (
          <div className="award-item">
            <div className="award-label">Freshman of Year</div>
            <div className="award-player">{awards.freshmanOfYear.playerName}</div>
            <div className="award-detail">
              {awards.freshmanOfYear.position} · {formatTeamName(awards.freshmanOfYear.teamName)} ·{' '}
              {awards.freshmanOfYear.overall} OVR
            </div>
          </div>
        )}
      </div>
      {awards.allConference.length > 0 && (
        <>
          <p className="section-label">All-Conference</p>
          <table className="standings-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Pos</th>
                <th>Team</th>
                <th>OVR</th>
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

function ResultRow({
  game,
  teamMap,
  userTeamId,
}: {
  game: ScheduledGame;
  teamMap: Map<string, string>;
  userTeamId: string;
}) {
  const { result } = game;
  if (!result) return null;

  const userInGame = game.homeTeamId === userTeamId || game.awayTeamId === userTeamId;
  const userWon = result.winnerTeamId === userTeamId;
  const className = userInGame
    ? userWon
      ? 'result-row win'
      : 'result-row loss'
    : 'result-row';

  return (
    <li className={className}>
      <span className="result-teams">
        {formatTeamName(teamMap.get(game.awayTeamId) ?? game.awayTeamId)}
        <span className="result-score">
          {result.awayScore}–{result.homeScore}
        </span>
        {formatTeamName(teamMap.get(game.homeTeamId) ?? game.homeTeamId)}
        {result.overtime && <span className="ot-badge">OT</span>}
      </span>
    </li>
  );
}

function formatTeamName(value: string): string {
  return value
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .replace('University', '')
    .trim();
}
