import type { AchievementWatchItem } from '../achievements';

/** Week Hub card: achievements one good week (or a few) from unlocking. */
export function AchievementWatchCard({ items, onOpenProfile }: { items: readonly AchievementWatchItem[]; onOpenProfile: () => void }) {
  if (items.length === 0) return null;
  return (
    <article className="card hub-card" aria-label="Achievement watch">
      <h3 className="hub-card-title">Achievement Watch</h3>
      <ul className="achievement-watch">
        {items.map(({ def, current, target }) => (
          <li key={def.id}>
            <span className={`tier-dot tier-${def.tier}`} aria-hidden="true" />
            <strong>{def.title}</strong>
            <span className="dim achievement-watch-left">
              {def.id === 'bragging-rights' && current === 0 ? 'Win this week’s trophy game' : `${target - current} to go · ${current}/${target}`}
            </span>
          </li>
        ))}
      </ul>
      <button className="hub-nav-link" onClick={onOpenProfile}>
        Open Profile →
      </button>
    </article>
  );
}
