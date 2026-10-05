import type { LacrossePlayer, LacrosseTeam } from '@sports-management-sim/sport-lacrosse';
import { comparePlayers, compareTally, type CompareRow } from '../player-compare';
import type { SeasonStatsMap } from '../stats';
import { formatTeamName } from '../ui/format';

interface Pick {
  player: LacrossePlayer;
  team: LacrosseTeam;
}

export function PlayerCompareCard({
  picks,
  seasonStats,
  onRemove,
  onClear,
}: {
  picks: Pick[];
  seasonStats: SeasonStatsMap;
  onRemove: (playerId: string) => void;
  onClear: () => void;
}) {
  const [first, second] = picks;
  if (!first) return null;

  const heading = (pick: Pick) => (
    <div className="compare-player-head">
      <strong>
        {pick.player.name.first} {pick.player.name.last}
      </strong>
      <span className="dim">
        {pick.player.position} · {pick.player.classYear} · {formatTeamName(pick.team.name)}
      </span>
      <button type="button" className="link-btn" onClick={() => onRemove(pick.player.id)}>
        Remove
      </button>
    </div>
  );

  if (!second) {
    return (
      <article className="card compare-card" aria-label="Player comparison">
        <div className="compare-heads">
          {heading(first)}
          <p className="dim compare-hint">Tick a second player to compare.</p>
        </div>
      </article>
    );
  }

  const sections = comparePlayers(first.player, second.player, {
    a: seasonStats[first.player.id],
    b: seasonStats[second.player.id],
  });
  const tally = compareTally(sections);

  return (
    <article className="card compare-card" aria-label="Player comparison">
      <div className="card-head-row">
        <h2>Compare</h2>
        <button type="button" className="ghost-btn" onClick={onClear}>
          Clear
        </button>
      </div>
      <div className="compare-heads">
        {heading(first)}
        <span className="compare-tally">
          {tally.a} – {tally.b}
          <span className="dim"> edges</span>
        </span>
        {heading(second)}
      </div>
      <div className="compare-sections">
        {sections.map((section) =>
          section.rows.length === 0 ? null : (
            <div key={section.title} className="compare-section">
              <p className="section-label">{section.title}</p>
              {section.rows.map((r) => (
                <CompareLine key={r.label} row={r} />
              ))}
            </div>
          ),
        )}
      </div>
    </article>
  );
}

function CompareLine({ row }: { row: CompareRow }) {
  const cls = (side: 'a' | 'b') => `compare-val${row.edge === side ? ' compare-better' : ''}`;
  return (
    <div className="compare-line">
      <span className={cls('a')}>{row.a ?? '—'}</span>
      <span className="compare-label">
        {row.label}
        {row.lowerIsBetter && <span className="dim" title="Lower is better"> ↓</span>}
      </span>
      <span className={cls('b')}>{row.b ?? '—'}</span>
    </div>
  );
}
