import type { Conference } from '@sports-management-sim/engine-core';
import { formatOrdinal, type SeasonPreview } from '../preseason';
import { formatTeamName, formatTeamShort } from '../ui/format';

export function SeasonPreviewCard({
  preview,
  conferences,
  teamMap,
  userTeamId,
  onSelectPlayer,
}: {
  preview: SeasonPreview;
  conferences: readonly Conference[];
  teamMap: Map<string, string>;
  userTeamId: string;
  onSelectPlayer: (playerId: string) => void;
}) {
  const conference = conferences.find((c) => c.teamIds.includes(userTeamId));
  const order = conference ? (preview.conferenceOrder[conference.id] ?? []) : [];
  const pick = order.indexOf(userTeamId) + 1;
  return (
    <article className="card season-preview-card" aria-label="Season preview">
      <p className="section-label">{preview.year} Season Preview</p>
      <div className="season-preview-grid">
        <div>
          <h3>
            {conference?.name ?? 'Conference'} poll
            {pick > 0 && <span className="dim"> · you're picked {formatOrdinal(pick)}</span>}
          </h3>
          <ol className="season-preview-poll">
            {order.map((teamId) => (
              <li key={teamId} className={teamId === userTeamId ? 'season-preview-user' : undefined}>
                {formatTeamName(teamMap.get(teamId) ?? teamId)}
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h3>Preseason watch list</h3>
          <ol className="season-preview-poll">
            {preview.watchList.map((player) => (
              <li key={player.playerId} className={player.teamId === userTeamId ? 'season-preview-user' : undefined}>
                <button type="button" className="practice-name-btn" onClick={() => onSelectPlayer(player.playerId)}>
                  {player.name}
                </button>
                <span className="dim">
                  {' '}
                  {player.position} · {player.classYear} · {formatTeamShort(player.teamName)} · {player.overall}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </article>
  );
}
