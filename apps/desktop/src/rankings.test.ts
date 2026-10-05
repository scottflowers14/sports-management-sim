import { describe, expect, it } from 'vitest';
import { finalPoll, finalPollRank } from './rankings';
import { buildFinalPollRows } from './dynasty-helpers';

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

describe('finalPoll', () => {
  const entries = poll.map((p) => ({ ...p, previousRank: p.rank, score: 100 - p.rank }));

  it('reorders the whole poll with the champion on top and keeps the old rank as previousRank', () => {
    const final = finalPoll(entries, 'c');
    expect(final.map((e) => [e.teamId, e.rank, e.previousRank])).toEqual([
      ['c', 1, 3],
      ['a', 2, 1],
      ['b', 3, 2],
      ['d', 4, 4],
    ]);
  });

  it('is the regular-season poll when no champion was crowned', () => {
    expect(finalPoll(entries, undefined).map((e) => e.rank)).toEqual([1, 2, 3, 4]);
  });
});

describe('buildFinalPollRows', () => {
  it('adds postseason games to the regular-season record, in poll order', () => {
    const standings = [
      { teamId: 'a', record: { wins: 9, losses: 1 } },
      { teamId: 'c', record: { wins: 7, losses: 3 } },
    ] as unknown as Parameters<typeof buildFinalPollRows>[1];
    const postseason = new Map([['c', { wins: 5, losses: 0 }], ['a', { wins: 1, losses: 1 }]]);
    expect(buildFinalPollRows([{ teamId: 'a', rank: 2 }, { teamId: 'c', rank: 1 }], standings, postseason)).toEqual([
      { teamId: 'c', rank: 1, wins: 12, losses: 3 },
      { teamId: 'a', rank: 2, wins: 10, losses: 2 },
    ]);
  });
});
