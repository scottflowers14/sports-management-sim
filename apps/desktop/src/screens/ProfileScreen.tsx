import { useEffect, useState } from 'react';
import {
  ACHIEVEMENTS,
  CATEGORY_LABELS,
  MAX_ACHIEVEMENT_POINTS,
  TIER_POINTS,
  achievementPoints,
  profileLevel,
  type AchievementCategory,
  type AchievementDef,
  type AchievementUnlock,
  type UnlockedAchievements,
} from '../achievements';
import { profileTotals, type PlayerProfile } from '../profile';
import { formatTeamName } from '../ui/format';

type Filter = 'all' | 'unlocked' | 'locked';

const CATEGORIES = Object.keys(CATEGORY_LABELS) as AchievementCategory[];

/** The player's profile: level, lifetime record across dynasties, and every achievement. */
export function ProfileScreen({
  profile,
  dynastyAchievements,
  activeSaveId = null,
  onSeen,
}: {
  profile: PlayerProfile;
  /** What this dynasty has earned, to mark "this dynasty" on the cards. */
  dynastyAchievements: UnlockedAchievements;
  activeSaveId?: string | null;
  /** Called on open, so the new-unlock badge clears once the profile is seen. */
  onSeen?: () => void;
}) {
  useEffect(() => {
    onSeen?.();
  }, [onSeen]);
  const [filter, setFilter] = useState<Filter>('all');
  const points = achievementPoints(profile.achievements);
  const { level, intoLevel, perLevel } = profileLevel(points);
  const unlockedCount = Object.keys(profile.achievements).length;
  const totals = profileTotals(profile);
  const recent = Object.entries(profile.achievements)
    .sort(([, a], [, b]) => b.at.localeCompare(a.at))
    .slice(0, 3);
  const careers = Object.entries(profile.careers).sort(([, a], [, b]) => b.lastYear - a.lastYear);

  const shown = (a: AchievementDef) =>
    filter === 'all' || (filter === 'unlocked' ? Boolean(profile.achievements[a.id]) : !profile.achievements[a.id]);

  return (
    <div className="profile-layout">
      <article className="card profile-hero" aria-label="Profile level">
        <div className="profile-level-badge">
          <span className="profile-level-num">{level}</span>
          <span className="profile-level-label">Level</span>
        </div>
        <div className="profile-hero-body">
          <p className="eyebrow">Coach Profile</p>
          <h2>
            {points} <span className="dim">/ {MAX_ACHIEVEMENT_POINTS} points</span>
          </h2>
          <div className="profile-progress" role="progressbar" aria-valuemin={0} aria-valuemax={perLevel} aria-valuenow={intoLevel}>
            <span style={{ width: `${(intoLevel / perLevel) * 100}%` }} />
          </div>
          <p className="dim">
            {unlockedCount} of {ACHIEVEMENTS.length} achievements · {perLevel - intoLevel} points to level {level + 1}
          </p>
        </div>
        {recent.length > 0 && (
          <div className="profile-recent">
            <p className="section-label">Recently unlocked</p>
            <ul>
              {recent.map(([id, unlock]) => {
                const def = ACHIEVEMENTS.find((a) => a.id === id);
                return def ? (
                  <li key={id}>
                    <span className={`tier-dot tier-${def.tier}`} aria-hidden="true" />
                    {def.title} <span className="dim">· {unlock.year}</span>
                  </li>
                ) : null;
              })}
            </ul>
          </div>
        )}
      </article>

      <div className="history-summary-row" aria-label="Lifetime totals">
        <Stat value={`${totals.wins}–${totals.losses}`} label="Lifetime Record" />
        <Stat value={totals.nationalTitles} label="Nat. Championships" />
        <Stat value={totals.confTitles} label="Conf. Titles" />
        <Stat value={totals.seasons} label="Seasons" />
        <Stat value={totals.dynasties} label="Dynasties" />
      </div>

      {careers.length > 0 && (
        <article className="card">
          <h2>Careers</h2>
          <table className="standings-table">
            <thead>
              <tr>
                <th>Coach</th>
                <th>Program</th>
                <th>Years</th>
                <th>Record</th>
                <th>Conf</th>
                <th>Titles</th>
              </tr>
            </thead>
            <tbody>
              {careers.map(([saveId, c]) => (
                <tr key={saveId} className={saveId === activeSaveId ? 'user-row' : undefined}>
                  <td>
                    {c.coachName}
                    {saveId === activeSaveId && <span className="dim"> · current</span>}
                  </td>
                  <td>{formatTeamName(c.teamName)}</td>
                  <td>
                    {c.firstYear}–{c.lastYear}
                  </td>
                  <td>
                    {c.wins}–{c.losses}
                  </td>
                  <td>{c.confTitles}</td>
                  <td>{c.nationalTitles}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      )}

      <article className="card">
        <div className="profile-achievements-head">
          <h2>Achievements</h2>
          <div className="news-filters" role="group" aria-label="Filter achievements">
            {(['all', 'unlocked', 'locked'] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`pos-filter-btn${filter === f ? ' active' : ''}`}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'unlocked' ? 'Unlocked' : 'Locked'}
              </button>
            ))}
          </div>
        </div>
        {CATEGORIES.map((category) => {
          const list = ACHIEVEMENTS.filter((a) => a.category === category && shown(a));
          if (list.length === 0) return null;
          return (
            <section key={category} className="achievement-group">
              <p className="section-label">{CATEGORY_LABELS[category]}</p>
              <ul className="achievement-grid">
                {list.map((a) => (
                  <AchievementCard key={a.id} def={a} unlock={profile.achievements[a.id]} thisDynasty={Boolean(dynastyAchievements[a.id])} />
                ))}
              </ul>
            </section>
          );
        })}
      </article>
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <article className="card history-stat-card">
      <p className="history-stat-num">{value}</p>
      <p className="history-stat-label">{label}</p>
    </article>
  );
}

function AchievementCard({ def, unlock, thisDynasty }: { def: AchievementDef; unlock: AchievementUnlock | undefined; thisDynasty: boolean }) {
  const hidden = def.secret && !unlock;
  return (
    <li className={`achievement-card tier-${def.tier}${unlock ? ' unlocked' : ' locked'}`} aria-label={hidden ? 'Secret achievement' : def.title}>
      <span className="achievement-medal" aria-hidden="true">
        {unlock ? '★' : '☆'}
      </span>
      <div>
        <p className="achievement-title">{hidden ? '???' : def.title}</p>
        <p className="achievement-desc">{hidden ? 'Keep coaching to find out.' : def.description}</p>
        <p className="achievement-meta">
          <span className="achievement-tier">
            {def.tier} · {TIER_POINTS[def.tier]} pts
          </span>
        </p>
        {unlock && (
          <p className="achievement-meta">
            {unlock.year}
            {unlock.teamName ? `, ${formatTeamName(unlock.teamName)}` : ''}
            {thisDynasty ? ' · this dynasty' : ''}
          </p>
        )}
      </div>
    </li>
  );
}
