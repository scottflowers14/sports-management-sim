import { useCallback, useState } from 'react';
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
import './App.css';

const initialDynasty = createNewLacrosseDynasty({
  seed: 2028,
  userTeamId: 'maryland-state',
  seasonYear: 2028,
});

type View = 'season' | 'recruiting' | 'standings' | 'offseason';

export function App() {
  const [dynasty, setDynasty] = useState<LacrosseDynastyState>(initialDynasty);
  const [view, setView] = useState<View>('season');
  const [lastSimWeek, setLastSimWeek] = useState<number | null>(null);
  const [offseasonSummary, setOffseasonSummary] = useState<OffseasonSummary | null>(null);

  const userTeam = dynasty.season.teams.find((t) => t.id === dynasty.userTeamId);

  const simWeek = useCallback(() => {
    const weekToSim = dynasty.season.currentWeek;
    setLastSimWeek(weekToSim);
    setDynasty((prev) => {
      const newSeason = advanceSeasonWeek(prev.season, (_game, homeTeam, awayTeam) =>
        simulateLacrosseGame({ homeTeam, awayTeam }),
      );
      const newRecruits = autoCommitWeekly(prev.recruits, newSeason.teams, Math.random);
      const updatedUserTeam = newSeason.teams.find((t) => t.id === prev.userTeamId)!;
      const newBoard = sortRecruitBoardForTeam(updatedUserTeam, newRecruits, prev.rosterTargets);
      return { ...prev, season: newSeason, recruits: newRecruits, recruitBoard: newBoard };
    });
  }, [dynasty.season.currentWeek]);

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
    setLastSimWeek(null);
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
        {view === 'offseason' && (
          <button className="tab active">Offseason</button>
        )}
      </nav>

      {view === 'season' && (
        <div className="dashboard-grid">
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
          </article>
        </div>
      )}

      {view === 'recruiting' && (
        <div className="recruit-grid">
          {dynasty.recruitBoard.slice(0, 24).map((entry) => {
            const { recruit } = entry;
            const interest = recruit.interestByTeamId[dynasty.userTeamId] ?? 0;
            const hasOffer = recruit.scholarshipOffers.some((o) => o.teamId === dynasty.userTeamId);
            const isCommittedToUs = recruit.committedTeamId === dynasty.userTeamId || recruit.signedTeamId === dynasty.userTeamId;
            const isCommittedElsewhere = recruit.status !== 'open' && !isCommittedToUs;

            return (
              <article key={recruit.id} className={`card recruit-card${isCommittedToUs ? ' committed-to-us' : ''}`}>
                <div className="recruit-header">
                  <div>
                    <strong>
                      {recruit.name.first} {recruit.name.last}
                    </strong>
                    <p className="recruit-sub">
                      {recruit.position} · {'★'.repeat(recruit.starRating)}{'☆'.repeat(5 - recruit.starRating)}
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
                      → {formatTeamName(teamMap.get(recruit.committedTeamId ?? recruit.signedTeamId ?? '') ?? 'Other')}
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
        <article className="card standings-card">
          <h2>Conference Standings</h2>
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
              {sortedStandings.map((entry, i) => (
                <tr key={entry.teamId} className={entry.teamId === dynasty.userTeamId ? 'user-row' : ''}>
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
                    <tr key={entry.teamId} className={entry.teamId === dynasty.userTeamId ? 'user-row' : ''}>
                      <td className="rank">#{i + 1}</td>
                      <td>{formatTeamName(teamMap.get(entry.teamId) ?? entry.teamId)}</td>
                      <td>{entry.record.wins}</td>
                      <td>{entry.record.losses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          </div>

          <div className="offseason-right">
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
    </main>
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
  const className = userInGame ? (userWon ? 'result-row win' : 'result-row loss') : 'result-row';

  return (
    <li className={className}>
      <span className="result-teams">
        {formatTeamName(teamMap.get(game.awayTeamId) ?? game.awayTeamId)}
        <span className="result-score">{result.awayScore}–{result.homeScore}</span>
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
