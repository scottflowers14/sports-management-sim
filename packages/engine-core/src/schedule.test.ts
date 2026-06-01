import { describe, expect, it } from 'vitest';
import { createRoundRobinSchedule } from './schedule';

describe('createRoundRobinSchedule', () => {
  it('creates six games for four teams', () => {
    const schedule = createRoundRobinSchedule(['a', 'b', 'c', 'd'], 2027);

    expect(schedule).toHaveLength(6);
  });

  it('schedules every team pair exactly once', () => {
    const schedule = createRoundRobinSchedule(['a', 'b', 'c', 'd'], 2027);
    const pairs = schedule.map((game) => [game.homeTeamId, game.awayTeamId].sort().join('-'));

    expect(new Set(pairs)).toEqual(new Set(['a-b', 'a-c', 'a-d', 'b-c', 'b-d', 'c-d']));
  });

  it('assigns scheduled status and season metadata', () => {
    const schedule = createRoundRobinSchedule(['a', 'b'], 2027);

    expect(schedule[0]).toMatchObject({
      id: '2027-week-1-a-vs-b',
      seasonYear: 2027,
      week: 1,
      homeTeamId: 'a',
      awayTeamId: 'b',
      conferenceGame: false,
      status: 'scheduled',
    });
  });
});
