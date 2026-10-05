import type { LacrossePlayer } from '@sports-management-sim/sport-lacrosse';
import type { PlayerForm } from '../player-form';

export function FormBadge({ form }: { form: PlayerForm | undefined }) {
  if (!form) return null;
  return (
    <span className={`form-badge form-${form.trend}`} title={form.line}>
      {form.trend === 'hot' ? 'HOT' : 'COLD'}
    </span>
  );
}

/** Week Hub card: who on the roster is on a heater, and who's in a slump. */
export function FormWatchCard({
  roster,
  form,
  onSelectPlayer,
}: {
  roster: readonly LacrossePlayer[];
  form: ReadonlyMap<string, PlayerForm>;
  onSelectPlayer: (playerId: string) => void;
}) {
  const rows = [...form.entries()]
    .map(([id, f]) => ({ player: roster.find((p) => p.id === id), form: f }))
    .filter((r): r is { player: LacrossePlayer; form: PlayerForm } => r.player !== undefined)
    .sort((a, b) => (a.form.trend === b.form.trend ? b.form.recent - a.form.recent : a.form.trend === 'hot' ? -1 : 1));
  return (
    <article className="card hub-card" aria-label="Form watch">
      <h3 className="hub-card-title">
        Hot &amp; Cold
        {rows.length > 0 && <span className="hub-card-badge">{rows.length}</span>}
      </h3>
      {rows.length > 0 ? (
        <ul className="form-watch-list">
          {rows.map(({ player, form: f }) => (
            <li key={player.id}>
              <button className="form-watch-row" onClick={() => onSelectPlayer(player.id)}>
                <FormBadge form={f} />
                <span className="form-watch-name">
                  {player.name.first} {player.name.last}
                  <span className="hub-injury-pos">{player.position}</span>
                </span>
                <span className="form-watch-line">{f.line}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dim hub-no-items">No one is on a streak. Streaks show after five games.</p>
      )}
    </article>
  );
}
