import { describe, expect, it } from 'vitest';
import { rushSetbackWeeks } from '@sports-management-sim/sport-lacrosse';
import { healInjuriesOneWeek, processInjuries, rushInjury, type InjuredPlayer } from './dynasty-helpers';

const SEED = 42;
const WEEK = 3;

/** Find player ids whose rush does / doesn't fail for a 4-week injury. */
function playerIds(failing: boolean): string {
  for (let i = 0; i < 200; i += 1) {
    const id = `p${i}`;
    if ((rushSetbackWeeks(4, id, WEEK, SEED) > 0) === failing) return id;
  }
  throw new Error('no id found');
}

function hurt(playerId: string, weeksRemaining = 4): InjuredPlayer {
  return { playerId, teamId: 'us', weeksRemaining, description: 'ankle sprain' };
}

describe('rushing an injured player back', () => {
  it('halves the time out once and ignores short injuries', () => {
    const [rushed] = rushInjury([hurt('a')], 'a', WEEK, SEED);
    expect(rushed).toMatchObject({ weeksRemaining: 2, rushed: true });
    expect(rushInjury([rushed!], 'a', WEEK, SEED)[0]).toEqual(rushed);
    expect(rushInjury([hurt('b', 1)], 'b', WEEK, SEED)[0]).toEqual(hurt('b', 1));
  });

  it('returns on time when the rush works', () => {
    let injuries = rushInjury([hurt(playerIds(false))], playerIds(false), WEEK, SEED);
    injuries = healInjuriesOneWeek(injuries);
    injuries = healInjuriesOneWeek(injuries);
    expect(injuries).toEqual([]);
  });

  it('puts a failed rush back on the list for the weeks saved plus one', () => {
    const id = playerIds(true);
    let injuries = rushInjury([hurt(id)], id, WEEK, SEED);
    expect(injuries[0]!.weeksRemaining).toBe(2);
    injuries = healInjuriesOneWeek(injuries);
    const result = processInjuries(injuries, [], () => 0.99);
    expect(result.setbacks).toEqual([{ playerId: id, teamId: 'us', weeksRemaining: 3 }]);
    expect(result.recovered).toEqual([]);
    expect(result.injuries[0]).toMatchObject({ weeksRemaining: 3, rushed: true, description: 'setback, ankle sprain' });
    expect(result.injuries[0]!.setbackWeeks).toBeUndefined();
    // Three more weeks and he's back for good.
    injuries = healInjuriesOneWeek(healInjuriesOneWeek(healInjuriesOneWeek(result.injuries)));
    expect(injuries).toEqual([]);
  });
});
