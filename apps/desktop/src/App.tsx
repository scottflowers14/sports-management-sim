import { createNewLacrosseDynasty } from '@sports-management-sim/sport-lacrosse';
import './App.css';

const dynasty = createNewLacrosseDynasty({
  seed: 2028,
  userTeamId: 'maryland-state',
  seasonYear: 2028,
});

export function App() {
  const userTeam = dynasty.season.teams.find((team) => team.id === dynasty.userTeamId);
  const upcomingGames = dynasty.season.schedule.slice(0, 3);
  const topRecruits = dynasty.recruitBoard.slice(0, 5);

  if (userTeam === undefined) {
    return <main>Unable to load dynasty team.</main>;
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Men&apos;s College Lacrosse Dynasty</p>
          <h1>Sports Management Sim</h1>
          <p className="lede">Build a roster, recruit hotbeds, and chase May.</p>
        </div>
        <section className="card team-card" aria-label="User team summary">
          <span className="label">User Team</span>
          <strong>{formatTeamName(userTeam.name)}</strong>
          <span>Current Week {dynasty.season.currentWeek}</span>
          <span>{userTeam.record.wins}-{userTeam.record.losses}</span>
        </section>
      </header>

      <section className="dashboard-grid" aria-label="Dynasty dashboard">
        <article className="card">
          <h2>Roster</h2>
          <p className="metric">{userTeam.roster.length} players</p>
          <p>{userTeam.resources.scholarshipUsed.toFixed(1)} / {userTeam.resources.scholarshipLimit.toFixed(1)} scholarships used</p>
          <ul>
            {Object.entries(dynasty.rosterTargets).map(([position, target]) => (
              <li key={position}>{position}: target {target}</li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2>Recruiting Board</h2>
          <ol>
            {topRecruits.map((entry) => (
              <li key={entry.recruit.id}>
                <strong>{entry.recruit.name.first} {entry.recruit.name.last}</strong>
                <span>{entry.recruit.position} · {entry.recruit.starRating}★ · score {entry.score}</span>
              </li>
            ))}
          </ol>
        </article>

        <article className="card">
          <h2>Schedule</h2>
          <ol>
            {upcomingGames.map((game) => (
              <li key={game.id}>
                <strong>Week {game.week}</strong>
                <span>{formatTeamName(game.awayTeamId)} at {formatTeamName(game.homeTeamId)}</span>
              </li>
            ))}
          </ol>
        </article>
      </section>
    </main>
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
