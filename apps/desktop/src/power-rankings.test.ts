import { describe, expect, it } from 'vitest';
import type { ScheduledGame } from '@sports-management-sim/engine-core';
import { POWER_RANKINGS_SIZE, powerRankingBlurbs, streakOf } from './power-rankings';
import type { RankingEntry } from './rankings';

let n = 0;
function final(week: number, home: string, away: string, homeScore: number, awayScore: number, overtime = false): ScheduledGame {
  const homeWon = homeScore > awayScore;
  return {
    id: `g${n++}`,
    seasonYear: 2026,
    week,
    homeTeamId: home,
    awayTeamId: away,
    conferenceGame: false,
    status: 'final',
    result: { homeScore, awayScore, winnerTeamId: homeWon ? home : away, loserTeamId: homeWon ? away : home, overtime },
  };
}
const upcoming = (week: number, home: string, away: string): ScheduledGame => ({
  id: `g${n++}`,
  seasonYear: 2026,
  week,
  homeTeamId: home,
  awayTeamId: away,
  conferenceGame: false,
  status: 'scheduled',
});

const ids = Array.from({ length: 12 }, (_, i) => `t${i + 1}`);
const rankings: RankingEntry[] = ids.map((teamId, i) => ({ teamId, rank: i + 1, previousRank: i + 1, score: 100 - i }));
const name = (id: string) => id.toUpperCase();

describe('power rankings', () => {
  it('tracks win and loss streaks from the latest game back', () => {
    const games = [final(1, 'a', 'b', 5, 9), final(2, 'a', 'c', 10, 8), final(3, 'd', 'a', 6, 7), final(4, 'a', 'e', 12, 4)];
    expect(streakOf(games, 'a')).toBe(3);
    expect(streakOf(games, 'b')).toBe(1);
    expect(streakOf([final(1, 'a', 'b', 9, 5), final(2, 'c', 'b', 9, 5)], 'b')).toBe(-2);
    expect(streakOf([], 'a')).toBe(0);
  });

  it('writes up the top ten with result, streak, ranked wins, movement and next game', () => {
    const schedule = [
      final(1, 't1', 't3', 10, 8),
      final(2, 't1', 't11', 12, 6),
      final(3, 't5', 't1', 9, 10, true),
      final(3, 't12', 't2', 9, 8),
      final(2, 't2', 't12', 4, 7),
      upcoming(4, 't1', 't4'),
      upcoming(4, 't6', 't2'),
    ];
    const moved = rankings.map((r) => (r.teamId === 't2' ? { ...r, previousRank: 6 } : r));
    const blurbs = powerRankingBlurbs(moved, schedule, name, 4);
    expect(blurbs).toHaveLength(POWER_RANKINGS_SIZE);
    expect(blurbs.map((b) => b.rank)).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
    const top = blurbs[0]!;
    expect(top.blurb).toBe('Edged #5 T5 10-9 in overtime. Winners of 3 straight. 2 wins over current top-10 teams. Next: hosts #4 T4.');
    const second = blurbs[1]!;
    expect(second.change).toBe(4);
    expect(second.blurb).toBe('Fell just short against T12 9-8. Has dropped 2 in a row. Up 4 spots. Next: at #6 T6.');
    expect(blurbs.find((b) => b.teamId === 't7')!.blurb).toBe('Has yet to take the field.');
  });

  it('calls a big win a rout', () => {
    const blurbs = powerRankingBlurbs(rankings, [final(1, 't3', 't11', 15, 6)], name, 2);
    expect(blurbs[2]!.blurb).toBe('Rolled T11 15-6.');
  });
});
