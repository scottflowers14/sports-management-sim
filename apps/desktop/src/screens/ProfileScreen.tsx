import { legacyScore, legacyTier, nextLegacyTier } from '../legacy';
import { useEffect, useState } from "react";
import {
  ACHIEVEMENTS,
  CATEGORY_LABELS,
  MAX_ACHIEVEMENT_POINTS,
  TIER_POINTS,
  achievementPoints,
  achievementProgress,
  nextProfileTitle,
  profileTitle,
  profileLevel,
  type AchievementCategory,
  type AchievementDef,
  type AchievementSnapshot,
  type AchievementUnlock,
  type UnlockedAchievements,
} from "../achievements";
import {
  profileBests,
  profileTotals,
  type PlayerProfile,
  type ProfileBest,
} from "../profile";
import { formatTeamName } from "../ui/format";

type Filter = "all" | "unlocked" | "locked";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as AchievementCategory[];

/** The player's profile: level, lifetime record across dynasties, and every achievement. */
export function ProfileScreen({
  profile,
  dynastyAchievements,
  activeSaveId = null,
  onSeen,
  challenges = { met: 0, faced: 0 },
  snapshot = null,
}: {
  profile: PlayerProfile;
  /** What this dynasty has earned, to mark "this dynasty" on the cards. */
  dynastyAchievements: UnlockedAchievements;
  activeSaveId?: string | null;
  /** Called on open, so the new-unlock badge clears once the profile is seen. */
  onSeen?: () => void;
  /** This dynasty's weekly challenges. */
  challenges?: { met: number; faced: number };
  /** This dynasty's progress, for the count-based achievements. */
  snapshot?: AchievementSnapshot | null;
}) {
  useEffect(() => {
    onSeen?.();
  }, [onSeen]);
  const [filter, setFilter] = useState<Filter>("all");
  const points = achievementPoints(profile.achievements);
  const { level, intoLevel, perLevel } = profileLevel(points);
  const unlockedCount = Object.keys(profile.achievements).length;
  const nextTitle = nextProfileTitle(level);
  const totals = profileTotals(profile);
  const recent = Object.entries(profile.achievements)
    .sort(([, a], [, b]) => b.at.localeCompare(a.at))
    .slice(0, 3);
  // The locked achievements this dynasty is closest to.
  const withinReach = snapshot
    ? ACHIEVEMENTS.filter((a) => !profile.achievements[a.id])
        .map((a) => ({ def: a, progress: achievementProgress(a, snapshot) }))
        .filter(
          (
            x,
          ): x is {
            def: AchievementDef;
            progress: { current: number; target: number };
          } => x.progress !== null && x.progress.current > 0,
        )
        .sort(
          (a, b) =>
            b.progress.current / b.progress.target -
            a.progress.current / a.progress.target,
        )
        .slice(0, 3)
    : [];
  const bests = profileBests(profile);
  const bestRows: {
    label: string;
    best: ProfileBest<unknown> | null;
    value: string;
    year?: number | undefined;
  }[] = [
    {
      label: "Best season",
      best: bests.bestSeason,
      value: bests.bestSeason
        ? `${bests.bestSeason.value.wins}–${bests.bestSeason.value.losses}`
        : "",
      year: bests.bestSeason?.value.year,
    },
    {
      label: "Best finish",
      best: bests.bestFinish,
      value: bests.bestFinish ? `#${bests.bestFinish.value.rank}` : "",
      year: bests.bestFinish?.value.year,
    },
    {
      label: "Biggest win",
      best: bests.biggestWin,
      value: bests.biggestWin
        ? `${bests.biggestWin.value.goalsFor}–${bests.biggestWin.value.goalsAgainst}`
        : "",
      year: bests.biggestWin?.value.year,
    },
    {
      label: "Most goals in a game",
      best: bests.mostGoals,
      value: bests.mostGoals ? `${bests.mostGoals.value.goalsFor}` : "",
      year: bests.mostGoals?.value.year,
    },
    {
      label: "Longest win streak",
      best: bests.longestWinStreak,
      value: bests.longestWinStreak
        ? `${bests.longestWinStreak.value} games`
        : "",
    },
    {
      label: "Most national titles",
      best: bests.mostTitles,
      value: bests.mostTitles ? `${bests.mostTitles.value}` : "",
    },
  ];
  const currentCareer = activeSaveId ? profile.careers[activeSaveId] : undefined;
  const currentLegacy = currentCareer ? legacyScore(currentCareer) : null;
  const nextLegacy = currentLegacy !== null ? nextLegacyTier(currentLegacy) : null;
  const careers = Object.entries(profile.careers).sort(
    ([, a], [, b]) => b.lastYear - a.lastYear,
  );

  const shown = (a: AchievementDef) =>
    filter === "all" ||
    (filter === "unlocked"
      ? Boolean(profile.achievements[a.id])
      : !profile.achievements[a.id]);

  return (
    <div className="profile-layout">
      <article className="card profile-hero" aria-label="Profile level">
        <div className="profile-level-badge">
          <span className="profile-level-num">{level}</span>
          <span className="profile-level-label">Level</span>
        </div>
        <div className="profile-hero-body">
          <p className="eyebrow">Coach Profile · {profileTitle(level)}</p>
          <h2>
            {points}{" "}
            <span className="dim">/ {MAX_ACHIEVEMENT_POINTS} points</span>
          </h2>
          <div
            className="profile-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={perLevel}
            aria-valuenow={intoLevel}
          >
            <span style={{ width: `${(intoLevel / perLevel) * 100}%` }} />
          </div>
          <p className="dim">
            {unlockedCount} of {ACHIEVEMENTS.length} achievements ·{" "}
            {perLevel - intoLevel} points to level {level + 1}
            {nextTitle && ` · "${nextTitle.title}" at level ${nextTitle.level}`}
          </p>
          {currentLegacy !== null && (
            <p className="profile-legacy" aria-label="Current legacy">
              Legacy: <strong>{legacyTier(currentLegacy)}</strong> <span className="dim">({currentLegacy})</span>
              {nextLegacy && (
                <span className="dim">
                  {" "}
                  · {nextLegacy.min - currentLegacy} to {nextLegacy.label}
                </span>
              )}
            </p>
          )}
        </div>
        {withinReach.length > 0 && (
          <div className="profile-recent" aria-label="Within reach">
            <p className="section-label">Within reach</p>
            <ul>
              {withinReach.map(({ def, progress }) => (
                <li key={def.id}>
                  <span
                    className={`tier-dot tier-${def.tier}`}
                    aria-hidden="true"
                  />
                  {def.title}{" "}
                  <span className="dim">
                    · {progress.current}/{progress.target}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {recent.length > 0 && (
          <div className="profile-recent">
            <p className="section-label">Recently unlocked</p>
            <ul>
              {recent.map(([id, unlock]) => {
                const def = ACHIEVEMENTS.find((a) => a.id === id);
                return def ? (
                  <li key={id}>
                    <span
                      className={`tier-dot tier-${def.tier}`}
                      aria-hidden="true"
                    />
                    {def.title} <span className="dim">· {unlock.year}</span>
                  </li>
                ) : null;
              })}
            </ul>
          </div>
        )}
      </article>

      <div className="history-summary-row" aria-label="Lifetime totals">
        <Stat
          value={`${totals.wins}–${totals.losses}`}
          label="Lifetime Record"
        />
        <Stat value={totals.nationalTitles} label="Nat. Championships" />
        <Stat value={totals.confTitles} label="Conf. Titles" />
        <Stat value={totals.seasons} label="Seasons" />
        <Stat value={totals.dynasties} label="Dynasties" />
        <Stat
          value={`${challenges.met}/${challenges.faced}`}
          label="Challenges Met"
        />
      </div>

      {bestRows.some((r) => r.best) && (
        <article className="card" aria-label="Personal bests">
          <h2>Personal Bests</h2>
          <ul className="personal-bests">
            {bestRows
              .filter((r) => r.best)
              .map((r) => (
                <li key={r.label}>
                  <p className="section-label">{r.label}</p>
                  <p className="personal-best-value">{r.value}</p>
                  <p className="dim personal-best-detail">
                    {r.year !== undefined ? `${r.year} · ` : ""}
                    {r.best!.coachName}, {formatTeamName(r.best!.teamName)}
                  </p>
                </li>
              ))}
          </ul>
        </article>
      )}

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
                <th>Legacy</th>
              </tr>
            </thead>
            <tbody>
              {careers.map(([saveId, c]) => (
                <tr
                  key={saveId}
                  className={saveId === activeSaveId ? "user-row" : undefined}
                >
                  <td>
                    {c.coachName}
                    {c.difficulty && (
                      <span className={`difficulty-tag difficulty-${c.difficulty}`}>{c.difficulty === 'hard' ? 'Hard' : 'Easy'}</span>
                    )}
                    {saveId === activeSaveId && (
                      <span className="dim"> · current</span>
                    )}
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
                  <td className="legacy-cell" aria-label={`${c.coachName} legacy`}>
                    <strong>{legacyTier(legacyScore(c))}</strong> <span className="dim">{legacyScore(c)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      )}

      <article className="card">
        <div className="profile-achievements-head">
          <h2>Achievements</h2>
          <div
            className="news-filters"
            role="group"
            aria-label="Filter achievements"
          >
            {(["all", "unlocked", "locked"] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`pos-filter-btn${filter === f ? " active" : ""}`}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : f === "unlocked" ? "Unlocked" : "Locked"}
              </button>
            ))}
          </div>
        </div>
        {CATEGORIES.map((category) => {
          const list = ACHIEVEMENTS.filter(
            (a) => a.category === category && shown(a),
          );
          if (list.length === 0) return null;
          return (
            <section key={category} className="achievement-group">
              <p className="section-label">{CATEGORY_LABELS[category]}</p>
              <ul className="achievement-grid">
                {list.map((a) => (
                  <AchievementCard
                    key={a.id}
                    def={a}
                    unlock={profile.achievements[a.id]}
                    thisDynasty={Boolean(dynastyAchievements[a.id])}
                    progress={
                      snapshot && !profile.achievements[a.id]
                        ? achievementProgress(a, snapshot)
                        : null
                    }
                  />
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

function AchievementCard({
  def,
  unlock,
  thisDynasty,
  progress = null,
}: {
  def: AchievementDef;
  unlock: AchievementUnlock | undefined;
  thisDynasty: boolean;
  progress?: { current: number; target: number } | null;
}) {
  const hidden = def.secret && !unlock;
  return (
    <li
      className={`achievement-card tier-${def.tier}${unlock ? " unlocked" : " locked"}`}
      aria-label={hidden ? "Secret achievement" : def.title}
    >
      <span className="achievement-medal" aria-hidden="true">
        {unlock ? "★" : "☆"}
      </span>
      <div>
        <p className="achievement-title">{hidden ? "???" : def.title}</p>
        <p className="achievement-desc">
          {hidden ? "Keep coaching to find out." : def.description}
        </p>
        <p className="achievement-meta">
          <span className="achievement-tier">
            {def.tier} · {TIER_POINTS[def.tier]} pts
          </span>
        </p>
        {progress && progress.current > 0 && (
          <div
            className="achievement-progress"
            aria-label={`${def.title} progress`}
          >
            <span className="achievement-progress-bar">
              <span
                style={{
                  width: `${(progress.current / progress.target) * 100}%`,
                }}
              />
            </span>
            <span className="achievement-progress-text">
              {progress.current} / {progress.target}
            </span>
          </div>
        )}
        {unlock && (
          <p className="achievement-meta">
            {unlock.year}
            {unlock.teamName ? `, ${formatTeamName(unlock.teamName)}` : ""}
            {thisDynasty ? " · this dynasty" : ""}
          </p>
        )}
      </div>
    </li>
  );
}
