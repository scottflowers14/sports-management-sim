import type { WeeklyHubData } from '../weekly-hub';
import { formatTeamName, formatTeamShort } from '../ui/format';

export function WeeklyHub({
  hub,
  onSelectPlayer,
}: {
  hub: WeeklyHubData;
  onSelectPlayer: (playerId: string) => void;
}) {
  const { preview, winProbability } = hub;
  const userPct = winProbability;
  const oppPct = 100 - userPct;
  const userName = formatTeamShort(preview.userTeam.shortName);
  const oppName = formatTeamShort(preview.opponent.shortName);

  return (
    <article className="card weekly-hub-card" aria-label="Weekly hub">
      <div className="weekly-hub-header">
        <div>
          <p className="eyebrow">Week {preview.game.week} · Coach Desk</p>
          <h2>
            {preview.userIsHome ? 'vs' : 'at'} {formatTeamName(hub.opponentName)}
          </h2>
          <p className="dim weekly-hub-sub">
            {hub.opponentRank !== null && <span className="hub-rank">#{hub.opponentRank}</span>}
            {hub.opponentRecord.wins}–{hub.opponentRecord.losses} · {preview.userIsHome ? 'Home' : 'Away'} · {preview.matchupNote}
          </p>
        </div>
        <div className="matchup-line">
          <span>{userName}</span>
          <strong>{preview.userRating.overall}</strong>
          <span>vs</span>
          <strong>{preview.opponentRating.overall}</strong>
          <span>{oppName}</span>
        </div>
      </div>

      <div className="winprob-block" aria-label="Win probability">
        <div className="winprob-labels">
          <span className="winprob-team">{userName} {userPct}%</span>
          <span className="winprob-team dim">{oppPct}% {oppName}</span>
        </div>
        <div className="winprob-bar">
          <div className="winprob-fill" style={{ width: `${userPct}%` }} />
        </div>
      </div>

      <div className="hub-strip">
        <div className="hub-form">
          <span className="hub-strip-label">Form</span>
          {hub.recentForm.length === 0 ? (
            <span className="dim">—</span>
          ) : (
            <span className="form-pills">
              {hub.recentForm.map((r, i) => (
                <span key={i} className={`form-pill form-${r}`}>{r}</span>
              ))}
            </span>
          )}
        </div>
        <div className="hub-edges">
          <HubEdge label="O" edge={preview.offenseEdge} />
          <HubEdge label="D" edge={preview.defenseEdge} />
          <HubEdge label="GK" edge={preview.goalieEdge} />
          <HubEdge label="FO" edge={preview.faceoffEdge} />
        </div>
      </div>

      {hub.keyPlayers.length > 0 && (
        <div className="hub-key-players">
          <span className="hub-strip-label">Players to Watch</span>
          <div className="hub-key-grid">
            {hub.keyPlayers.map((p) => (
              <button
                key={p.playerId}
                className={`hub-key-player${p.isUser ? ' hub-key-user' : ''}`}
                onClick={() => onSelectPlayer(p.playerId)}
                title={`View ${p.name}`}
              >
                <span className="hub-key-name">{p.name}</span>
                <span className="hub-key-meta">
                  {p.isUser ? userName : oppName} · {p.position} · {p.line}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function HubEdge({ label, edge }: { label: string; edge: number }) {
  const signed = edge > 0 ? `+${edge}` : `${edge}`;
  const className = edge > 0 ? 'positive' : edge < 0 ? 'negative' : 'even';
  return (
    <div className={`hub-edge ${className}`} title={`${label} edge`}>
      <span>{label}</span>
      <strong>{signed}</strong>
    </div>
  );
}
