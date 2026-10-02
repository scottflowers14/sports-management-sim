import { describe, expect, it } from 'vitest';
import { analyzeRosterNeeds, sortRecruitBoardForTeam } from './recruit-board';
import { makeRecruit, makeTeam } from './test-fixtures';

describe('recruit board helpers', () => {
  it('analyzes roster needs by comparing current counts against targets', () => {
    const needs = analyzeRosterNeeds(makeTeam(), { ATT: 3, MID: 4, DEF: 3, GK: 2, FOGO: 1 });

    expect(needs).toEqual([
      { position: 'ATT', current: 1, target: 3, need: 2 },
      { position: 'MID', current: 2, target: 4, need: 2 },
      { position: 'DEF', current: 1, target: 3, need: 2 },
      { position: 'GK', current: 1, target: 2, need: 1 },
      { position: 'FOGO', current: 0, target: 1, need: 1 },
    ]);
  });

  it('sorts recruit board by team fit, roster need, and recruit quality', () => {
    const team = makeTeam();
    const recruits = [
      makeRecruit('att-good', 'ATT', 65, 50),
      makeRecruit('fogo-needed', 'FOGO', 55, 50),
      makeRecruit('mid-good', 'MID', 75, 50),
    ];

    const board = sortRecruitBoardForTeam(team, recruits, { ATT: 3, MID: 4, DEF: 3, GK: 2, FOGO: 1 });

    expect(board[0]?.recruit.id).toBe('fogo-needed');
    expect(board.map((entry) => entry.recruit.id)).toEqual(['fogo-needed', 'att-good', 'mid-good']);
    expect(board[0]?.needScore).toBeGreaterThan(board[1]?.needScore ?? 0);
  });
});
