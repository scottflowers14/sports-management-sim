import { describe, expect, it } from 'vitest';
import { finalPollRank } from './rankings';

const poll = [
  { teamId: 'a', rank: 1 },
  { teamId: 'b', rank: 2 },
  { teamId: 'c', rank: 3 },
  { teamId: 'd', rank: 4 },
];

describe('finalPollRank', () => {
  it('puts the national champion at #1 and slides the teams it passed down a spot', () => {
    expect(finalPollRank(poll, 'c', 'c')).toBe(1);
    expect(finalPollRank(poll, 'a', 'c')).toBe(2);
    expect(finalPollRank(poll, 'b', 'c')).toBe(3);
    expect(finalPollRank(poll, 'd', 'c')).toBe(4);
  });

  it('crowns an unranked champion and keeps the poll otherwise', () => {
    expect(finalPollRank(poll, 'z', 'z')).toBe(1);
    expect(finalPollRank(poll, 'a', 'z')).toBe(2);
    expect(finalPollRank(poll, 'b', null)).toBe(2);
    expect(finalPollRank(poll, 'z', 'a')).toBeNull();
  });
});
