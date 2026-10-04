import { describe, expect, it } from 'vitest';
import type { Conference } from '@sports-management-sim/engine-core';
import { createFreshLacrosseDynasty } from './dynasty-factory';
import { buildSeasonPreview, formatOrdinal, predictedFinish, previewHeadlines, versusPrediction, WATCH_LIST_SIZE } from './preseason';

describe('the preseason poll', () => {
  const dynasty = createFreshLacrosseDynasty({ now: () => 11 });
  const { teams, conferences, year } = dynasty.season;
  const preview = buildSeasonPreview(year, teams, conferences);

  it('orders every conference and picks a national watch list', () => {
    for (const conference of conferences) {
      expect([...(preview.conferenceOrder[conference.id] ?? [])].sort()).toEqual([...conference.teamIds].sort());
    }
    expect(preview.watchList).toHaveLength(WATCH_LIST_SIZE);
    const overalls = preview.watchList.map((p) => p.overall);
    expect(overalls).toEqual([...overalls].sort((a, b) => b - a));
    const best = Math.max(...teams.flatMap((t) => t.roster.map((p) => p.ratings.overall)));
    expect(overalls[0]).toBe(best);
  });

  it('drops a favorite that loses its talent', () => {
    const conference = conferences[0]!;
    const order = preview.conferenceOrder[conference.id]!;
    const strong = teams.find((t) => t.id === order[0])!;
    // Weaken the favorite and it slides down the poll.
    const weakened = teams.map((t) =>
      t.id === strong.id ? { ...t, roster: t.roster.map((p) => ({ ...p, ratings: { ...p.ratings, overall: 30 } })), reputation: { ...t.reputation, nationalPrestige: 10 } } : t,
    );
    const again = buildSeasonPreview(year, weakened, conferences).conferenceOrder[conference.id]!;
    expect(again.indexOf(strong.id)).toBeGreaterThan(0);
  });

  it('knows where a team was picked and says how the season went against it', () => {
    const conference = conferences.find((c) => c.teamIds.includes(dynasty.userTeamId)) as Conference;
    const pick = predictedFinish(preview, dynasty.userTeamId)!;
    expect(preview.conferenceOrder[conference.id]![pick - 1]).toBe(dynasty.userTeamId);
    expect(predictedFinish(null, dynasty.userTeamId)).toBeNull();
    expect(versusPrediction(5, 2)).toBe('Picked 5th, finished 2nd');
    expect(versusPrediction(undefined, 2)).toBeNull();
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(formatOrdinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
  });

  it('writes headlines for the user’s conference', () => {
    const headlines = previewHeadlines(preview, conferences, (id) => id, dynasty.userTeamId);
    const pick = predictedFinish(preview, dynasty.userTeamId)!;
    expect(headlines.some((h) => h.includes(dynasty.userTeamId) && h.startsWith('Preseason poll:'))).toBe(true);
    if (pick > 1) expect(headlines[0]).toMatch(/picked to win the/);
  });
});
