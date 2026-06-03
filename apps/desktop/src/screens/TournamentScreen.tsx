import type { TournamentState, TournamentGame, ConferenceBracket } from '../tournament';
import type { BoxScoreData } from '../ui/types';
import { formatTeamName } from '../ui/format';

export function TournamentScreen({
  tournament,
  teamMap,
  userTeamId,
  seasonComplete,
  onSimSemis,
  onSimFinals,
  onSimNational,
  onEnterOffseason,
  onInitTournament,
  onBoxScore,
}: {
  tournament: TournamentState | null;
  teamMap: Map<string, string>;
  userTeamId: string;
  seasonComplete: boolean;
  onSimSemis: () => void;
  onSimFinals: () => void;
  onSimNational: () => void;
  onEnterOffseason: () => void;
  onInitTournament: () => void;
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
      ...(result.log ? { log: result.log } : {}),
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
