import type { TournamentState, TournamentGame, ConferenceBracket, NcaaEntry } from '../tournament';
import type { BoxScoreData } from '../ui/types';
import { formatTeamName } from '../ui/format';

export function TournamentScreen({
  tournament,
  teamMap,
  userTeamId,
  seasonComplete,
  onSimSemis,
  onSimFinals,
  onSimNcaaFirstRound,
  onSimNcaaQuarterfinals,
  onSimNationalSemis,
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
  onSimNcaaFirstRound: () => void;
  onSimNcaaQuarterfinals: () => void;
  onSimNationalSemis: () => void;
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

  const phase = tournament.phase;
  const controls = (
    <div className="tournament-controls">
      {phase === 'conf_semis' && (
        <button className="sim-btn" onClick={onSimSemis}>Sim Conference Semifinals</button>
      )}
      {phase === 'conf_finals' && (
        <button className="sim-btn" onClick={onSimFinals}>Sim Conference Finals</button>
      )}
      {phase === 'ncaa_first_round' && (
        <button className="sim-btn" onClick={onSimNcaaFirstRound}>Sim NCAA First Round</button>
      )}
      {phase === 'ncaa_quarterfinals' && (
        <button className="sim-btn" onClick={onSimNcaaQuarterfinals}>Sim NCAA Quarterfinals</button>
      )}
      {phase === 'national_semis' && (
        <button className="sim-btn" onClick={onSimNationalSemis}>Sim National Semifinals</button>
      )}
      {phase === 'national_final' && (
        <button className="sim-btn" onClick={onSimNational}>Sim National Championship</button>
      )}
      {phase === 'complete' && (
        <button className="offseason-btn" onClick={onEnterOffseason}>Enter Offseason →</button>
      )}
    </div>
  );

  const conferenceCards = (
    <div className="tournament-conferences">
      {tournament.conferenceBrackets.map((bracket) => (
        <ConferenceBracketCard
          key={bracket.conferenceId}
          bracket={bracket}
          confLabel={bracket.conferenceId.toUpperCase()}
          teamMap={teamMap}
          userTeamId={userTeamId}
          onBoxScore={onBoxScore}
        />
      ))}
    </div>
  );

  if (tournament.ncaaField) {
    return (
      <div className="tournament-layout">
        {controls}
        <NcaaSection tournament={tournament} field={tournament.ncaaField} teamMap={teamMap} userTeamId={userTeamId} onBoxScore={onBoxScore} />
        <h2 className="tournament-section-title">Conference Tournaments</h2>
        {conferenceCards}
      </div>
    );
  }

  return (
    <div className="tournament-layout">
      {controls}
      {phase === 'conf_finals' || phase === 'conf_semis' ? (
        <p className="dim">
          Conference champions earn automatic bids to a 12-team NCAA tournament. The best remaining teams by RPI
          fill the at-large spots on selection day.
        </p>
      ) : null}
      {conferenceCards}

      {(phase === 'national_semis' || phase === 'national_final' || phase === 'complete') &&
        tournament.nationalSemiFinal1 && tournament.nationalSemiFinal2 && (
        <article className="card national-champ-card">
          <h2>National Semifinals</h2>
          <BracketMatchup
            game={tournament.nationalSemiFinal1}
            seeds={[]}
            teamMap={teamMap}
            userTeamId={userTeamId}
            onBoxScore={onBoxScore}
            title="National Semifinal 1"
          />
          <BracketMatchup
            game={tournament.nationalSemiFinal2}
            seeds={[]}
            teamMap={teamMap}
            userTeamId={userTeamId}
            onBoxScore={onBoxScore}
            title="National Semifinal 2"
          />
        </article>
      )}

      {(phase === 'national_final' || phase === 'complete') && tournament.nationalGame && (
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
          <ChampionBanner tournament={tournament} teamMap={teamMap} />
        </article>
      )}
    </div>
  );
}

function ChampionBanner({ tournament, teamMap }: { tournament: TournamentState; teamMap: Map<string, string> }) {
  if (!tournament.nationalChampion) return null;
  return (
    <div className="national-champion-banner">
      <span className="champion-label">National Champion</span>
      <span className="champion-name champion-name-lg">
        {formatTeamName(teamMap.get(tournament.nationalChampion) ?? tournament.nationalChampion)}
      </span>
    </div>
  );
}

function NcaaSection({
  tournament,
  field,
  teamMap,
  userTeamId,
  onBoxScore,
}: {
  tournament: TournamentState;
  field: NcaaEntry[];
  teamMap: Map<string, string>;
  userTeamId: string;
  onBoxScore: (data: BoxScoreData) => void;
}) {
  const seeds = [...field].sort((a, b) => a.seed - b.seed).map((e) => e.teamId);
  const name = (id: string) => formatTeamName(teamMap.get(id) ?? id);
  const userEntry = field.find((e) => e.teamId === userTeamId);
  const userFirstOut = (tournament.ncaaFirstOut ?? []).findIndex((e) => e.teamId === userTeamId);
  const userLine = userEntry
    ? `${name(userTeamId)} is the #${userEntry.seed} seed (${userEntry.bid === 'auto' ? 'automatic bid' : 'at-large'})${userEntry.seed <= 4 ? ' with a first-round bye' : ''}.`
    : userFirstOut >= 0
      ? `${name(userTeamId)} was left out, number ${userFirstOut + 1} among the first four out.`
      : `${name(userTeamId)} did not make the field.`;

  const rounds: Array<{ label: string; games: TournamentGame[] | undefined; prefix: string; slots: number }> = [
    { label: 'First Round', games: tournament.ncaaFirstRound, prefix: 'NCAA First Round', slots: 4 },
    { label: 'Quarterfinals', games: tournament.ncaaQuarterfinals, prefix: 'NCAA Quarterfinal', slots: 4 },
    {
      label: 'Final Four',
      games: tournament.nationalSemiFinal1 && tournament.nationalSemiFinal2
        ? [tournament.nationalSemiFinal1, tournament.nationalSemiFinal2]
        : undefined,
      prefix: 'National Semifinal',
      slots: 2,
    },
    {
      label: 'Championship',
      games: tournament.nationalGame ? [tournament.nationalGame] : undefined,
      prefix: 'National Championship',
      slots: 1,
    },
  ];

  return (
    <article className="card ncaa-card" aria-label="NCAA tournament">
      <div className="ncaa-header">
        <div>
          <p className="eyebrow">Selection Day</p>
          <h2>NCAA Tournament</h2>
        </div>
        <p className={userEntry ? 'ncaa-user-line in' : 'ncaa-user-line out'}>{userLine}</p>
      </div>

      <div className="ncaa-grid">
        <div className="ncaa-field">
          <table className="data-grid">
            <thead>
              <tr><th>Seed</th><th>Team</th><th>Bid</th><th>RPI</th></tr>
            </thead>
            <tbody>
              {[...field].sort((a, b) => a.seed - b.seed).map((e) => (
                <tr key={e.teamId} className={e.teamId === userTeamId ? 'user-row' : ''}>
                  <td className="num">{e.seed}</td>
                  <td>{name(e.teamId)}{e.seed <= 4 && <span className="conf-tag" title="First-round bye">BYE</span>}</td>
                  <td>{e.bid === 'auto' ? 'AQ' : 'At-large'}</td>
                  <td className="num">{e.rpi.toFixed(3).replace(/^0/, '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(tournament.ncaaFirstOut?.length ?? 0) > 0 && (
            <div className="ncaa-bubble">
              <p className="section-label">First Four Out</p>
              {tournament.ncaaFirstOut!.map((e) => (
                <div key={e.teamId} className={e.teamId === userTeamId ? 'ncaa-bubble-row user' : 'ncaa-bubble-row'}>
                  <span>{name(e.teamId)}</span>
                  <span className="dim">{e.rpi.toFixed(3).replace(/^0/, '')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ncaa-bracket">
          {rounds.map((round) => (
            <div key={round.label} className="ncaa-round">
              <p className="section-label">{round.label}</p>
              {round.games
                ? round.games.map((game, i) => (
                    <BracketMatchup
                      key={game.id}
                      game={game}
                      seeds={seeds}
                      teamMap={teamMap}
                      userTeamId={userTeamId}
                      onBoxScore={onBoxScore}
                      title={round.slots > 1 ? `${round.prefix} ${i + 1}` : round.prefix}
                    />
                  ))
                : Array.from({ length: round.slots }, (_, i) => (
                    <div key={i} className="bracket-tbd">
                      <div className="bracket-team tbd-team"><span>TBD</span></div>
                      <div className="bracket-vs">vs</div>
                      <div className="bracket-team tbd-team"><span>TBD</span></div>
                    </div>
                  ))}
              {round.label === 'Championship' && <ChampionBanner tournament={tournament} teamMap={teamMap} />}
            </div>
          ))}
        </div>
      </div>
    </article>
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
