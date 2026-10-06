import { ACHIEVEMENT_BY_ID, TIER_POINTS, achievementXp, profileTitle } from '../achievements';

/** Pops up when achievements unlock; lists the first few and links to the profile. */
export function AchievementToast({
  ids,
  levelUp = null,
  onView,
  onDismiss,
}: {
  ids: readonly string[];
  /** The profile level just reached, if these unlocks crossed one. */
  levelUp?: number | null;
  onView: () => void;
  onDismiss: () => void;
}) {
  const defs = ids.map((id) => ACHIEVEMENT_BY_ID.get(id)).filter((d) => d !== undefined);
  if (defs.length === 0) return null;
  // Newest first: the toast stays up until dismissed, so it can collect several.
  const shown = [...defs].reverse().slice(0, 3);
  const points = defs.reduce((sum, d) => sum + TIER_POINTS[d.tier], 0);
  return (
    <aside className="achievement-toast" role="status" aria-label="Achievement unlocked">
      <p className="eyebrow">{defs.length === 1 ? 'Achievement unlocked' : `${defs.length} achievements unlocked`} · +{points} pts · +{achievementXp(defs)} coach XP</p>
      {levelUp !== null && (
        <p className="achievement-levelup">
          Level {levelUp}! You're now a <strong>{profileTitle(levelUp)}</strong>.
        </p>
      )}
      <ul>
        {shown.map((d) => (
          <li key={d.id} className={`tier-${d.tier}`}>
            <span className="achievement-medal" aria-hidden="true">★</span>
            <span>
              <strong>{d.title}</strong>
              <span className="dim"> {d.description}</span>
            </span>
          </li>
        ))}
      </ul>
      {defs.length > shown.length && <p className="dim">and {defs.length - shown.length} more</p>}
      <div className="achievement-toast-actions">
        <button type="button" className="primary-action" onClick={onView}>
          View profile
        </button>
        <button type="button" className="ghost-btn" onClick={onDismiss} aria-label="Dismiss achievements">
          Dismiss
        </button>
      </div>
    </aside>
  );
}
