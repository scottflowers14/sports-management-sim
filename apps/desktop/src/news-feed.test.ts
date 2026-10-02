import { describe, expect, it } from 'vitest';
import type { LacrosseSeason } from '@sports-management-sim/sport-lacrosse';
import { generateRecruitingNews, generateWeeklyNews, type RankingEntry } from './news-feed';

const teamMap = new Map([
  ['us', 'Us'],
  ['top', 'Top U'],
  ['mid', 'Mid State'],
  ['low', 'Low Tech'],
  ['a', 'Alpha'],
  ['b', 'Bravo'],
]);

function final(id: string, home: string, away: string, homeScore: number, awayScore: number) {
  const winnerTeamId = homeScore > awayScore ? home : away;
  const loserTeamId = winnerTeamId === home ? away : home;
  return {
    id,
    week: 3,
    homeTeamId: home,
    awayTeamId: away,
    status: 'final',
    result: { homeScore, awayScore, winnerTeamId, loserTeamId, overtime: false },
  };
}

describe('generateWeeklyNews', () => {
  const rankings: RankingEntry[] = [
    { teamId: 'top', rank: 2, score: 0 },
    { teamId: 'mid', rank: 7, score: 0 },
    { teamId: 'b', rank: 9, score: 0 },
  ];
  const season = {
    schedule: [
      final('g1', 'us', 'a', 10, 8),
      final('g2', 'top', 'b', 12, 5),
      final('g3', 'low', 'mid', 9, 7),
      final('g4', 'a', 'low', 8, 6),
    ],
  } as unknown as LacrosseSeason;
  const items = generateWeeklyNews({ week: 3, season, previousRankings: rankings, newRankings: rankings, userTeamId: 'us', teamMap });

  it('features our game and headlines top-10 matchups and upsets', () => {
    expect(items.find((i) => i.featured)?.headline).toBe('Us wins 10-8 over Alpha');
    expect(items.some((i) => i.headline === '#2 Top U defeats #9 Bravo 12-5')).toBe(true);
    expect(items.some((i) => i.headline === 'Upset: Low Tech stuns #7 Mid State 9-7')).toBe(true);
  });

  it('folds the rest of the slate into one line', () => {
    expect(items.filter((i) => i.category === 'game')).toHaveLength(4);
    expect(items.at(-1)?.headline).toMatch(/^Around the league: 1 more result/);
  });
});

describe('generateRecruitingNews', () => {
  const recruit = (id: string, stars: number, teamId: string) =>
    ({ id, starRating: stars, position: 'MID', name: { first: 'R', last: id }, committedTeamId: teamId }) as never;

  it('headlines our commits and 4-star-plus recruits, and counts the rest', () => {
    const items = generateRecruitingNews({
      week: 3,
      recruits: [recruit('one', 2, 'us'), recruit('two', 5, 'a'), recruit('three', 3, 'b'), recruit('four', 1, 'b')],
      userTeamId: 'us',
      teamMap,
    });
    expect(items.map((i) => i.headline)).toEqual([
      '★★★★★ MID R two commits to Alpha',
      'Commitment! ★★ MID R one commits to Us',
      '2 more recruits rated 3★ or lower committed elsewhere',
    ]);
    expect(items.filter((i) => i.featured)).toHaveLength(1);
  });
});
