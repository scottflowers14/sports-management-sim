import { describe, expect, it } from 'vitest';
import type { Player, Team } from './models';
import type { Recruit } from './recruiting';
import { analyzeRosterNeeds, sortRecruitBoardForTeam } from './recruit-board';

function makePlayer(id: string, position: 'ATT' | 'MID' | 'DEF' | 'GK' | 'FOGO'): Player<'ATT' | 'MID' | 'DEF' | 'GK' | 'FOGO'> {
  return {
    id,
    name: { first: 'Player', last: id },
    age: 20,
    classYear: 'SO',
    hometown: 'Baltimore, MD',
    regionId: 'mid-atlantic',
    position,
    secondaryPositions: [],
    ratings: {
      overall: 60,
      potential: 80,
      athleticism: 60,
      speed: 60,
      strength: 60,
      stamina: 60,
      skill: 60,
      iq: 60,
      discipline: 60,
      workEthic: 60,
      leadership: 60,
    },
    traits: [],
    sportTraits: undefined,
    scholarshipPercent: 0,
    isWalkOn: true,
    morale: 50,
    health: 100,
    fatigue: 0,
    redshirtStatus: 'none',
    eligibility: {
      seasonsPlayed: 0,
      seasonsRemaining: 4,
      isEligible: true,
    },
    createdSeason: 2027,
  };
}

function makeTeam(): Team<'ATT' | 'MID' | 'DEF' | 'GK' | 'FOGO'> {
  return {
    id: 'team-1',
    name: 'Test University',
    shortName: 'Test',
    schoolName: 'Test University',
    conferenceId: 'conference-1',
    regionId: 'mid-atlantic',
    reputation: {
      nationalPrestige: 70,
      academicPrestige: 70,
      coachingPrestige: 70,
      facilities: 70,
      fanSupport: 70,
      recentSuccess: 70,
    },
    resources: {
      scholarshipLimit: 12.6,
      scholarshipUsed: 10,
      recruitingBudget: 100_000,
      staffBudget: 250_000,
      facilitiesBudget: 500_000,
    },
    roster: [makePlayer('a1', 'ATT'), makePlayer('m1', 'MID'), makePlayer('m2', 'MID'), makePlayer('d1', 'DEF'), makePlayer('g1', 'GK')],
    record: {
      wins: 0,
      losses: 0,
      conferenceWins: 0,
      conferenceLosses: 0,
      homeWins: 0,
      homeLosses: 0,
      awayWins: 0,
      awayLosses: 0,
      neutralWins: 0,
      neutralLosses: 0,
    },
    createdSeason: 2027,
  };
}

function makeRecruit(id: string, position: 'ATT' | 'MID' | 'DEF' | 'GK' | 'FOGO', overall: number, interest = 50): Recruit<'ATT' | 'MID' | 'DEF' | 'GK' | 'FOGO'> {
  return {
    id,
    name: { first: 'Recruit', last: id },
    age: 17,
    hometown: 'Baltimore, MD',
    regionId: 'mid-atlantic',
    position,
    starRating: 3,
    ratings: {
      overall,
      potential: overall + 20,
      athleticism: overall,
      speed: overall,
      strength: overall,
      stamina: overall,
      skill: overall,
      iq: overall,
      discipline: overall,
      workEthic: overall,
      leadership: overall,
    },
    preferences: {
      proximityImportance: 70,
      prestigeImportance: 70,
      scholarshipImportance: 70,
      playingTimeImportance: 70,
      academicImportance: 70,
    },
    interestByTeamId: { 'team-1': interest },
    scholarshipOffers: [],
    status: 'open',
  };
}

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
    expect(board.map((entry) => entry.recruit.id)).toEqual(['fogo-needed', 'mid-good', 'att-good']);
    expect(board[0]?.needScore).toBeGreaterThan(board[1]?.needScore ?? 0);
  });
});
