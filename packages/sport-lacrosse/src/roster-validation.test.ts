import { describe, expect, it } from 'vitest';
import type { LacrossePlayer, LacrossePosition, LacrosseTeam } from './models';
import { validateLacrosseRoster } from './roster-validation';

function makePlayer(index: number, position: LacrossePosition, scholarshipPercent = 0): LacrossePlayer {
  return {
    id: `player-${index}`,
    name: { first: 'Player', last: `${index}` },
    age: 18,
    classYear: 'FR',
    hometown: 'Baltimore, MD',
    regionId: 'mid-atlantic',
    position,
    secondaryPositions: [],
    ratings: {
      overall: 50,
      potential: 70,
      athleticism: 55,
      speed: 60,
      strength: 50,
      stamina: 60,
      skill: 55,
      iq: 50,
      discipline: 50,
      workEthic: 60,
      leadership: 40,
    },
    traits: [],
    sportTraits: {
      shooting: 50,
      passing: 50,
      dodging: 50,
      stickSkills: 55,
      offBallMovement: 50,
      defense: 50,
      checking: 45,
      groundBalls: 55,
      ...(position === 'FOGO' ? { faceoffs: 85 } : {}),
      ...(position === 'GK'
        ? { goalieReflexes: 75, goaliePositioning: 72, goalieClearing: 65 }
        : {}),
      preferredHand: index % 2 === 0 ? 'right' : 'left',
    },
    scholarshipPercent,
    isWalkOn: scholarshipPercent === 0,
    morale: 50,
    health: 100,
    fatigue: 0,
    redshirtStatus: 'redshirt_available',
    eligibility: {
      seasonsPlayed: 0,
      seasonsRemaining: 4,
      isEligible: true,
    },
    createdSeason: 2027,
  };
}

function makeRoster(size = 45, overrides: Partial<Record<number, LacrossePosition>> = {}): LacrossePlayer[] {
  return Array.from({ length: size }, (_, index) => {
    const position = overrides[index] ?? (index === 0 ? 'GK' : index === 1 ? 'FOGO' : 'MID');
    return makePlayer(index, position, index < 42 ? 30 : 0);
  });
}

function makeTeam(roster = makeRoster(), scholarshipUsed = 12.6): LacrosseTeam {
  return {
    id: 'maryland',
    name: 'Maryland Terrapins',
    shortName: 'Maryland',
    schoolName: 'University of Maryland',
    conferenceId: 'big-ten',
    regionId: 'mid-atlantic',
    reputation: {
      nationalPrestige: 95,
      academicPrestige: 80,
      coachingPrestige: 90,
      facilities: 88,
      fanSupport: 85,
      recentSuccess: 90,
    },
    resources: {
      scholarshipLimit: 12.6,
      scholarshipUsed,
      recruitingBudget: 250_000,
      staffBudget: 750_000,
      facilitiesBudget: 2_000_000,
    },
    roster,
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

describe('validateLacrosseRoster', () => {
  it('accepts a valid 45-player roster with a goalie, FOGO, and legal scholarship usage', () => {
    const team = makeTeam();

    expect(validateLacrosseRoster(team)).toEqual({ ok: true, value: team });
  });

  it('rejects a roster with more than 45 players', () => {
    expect(validateLacrosseRoster(makeTeam(makeRoster(46)))).toEqual({
      ok: false,
      error: ['Team maryland has 46 players; maximum is 45'],
    });
  });

  it('rejects a roster without a goalie', () => {
    const roster = makeRoster(45, { 0: 'MID', 1: 'FOGO' });

    expect(validateLacrosseRoster(makeTeam(roster))).toEqual({
      ok: false,
      error: ['Team maryland must roster at least one GK'],
    });
  });

  it('rejects a roster without a face-off specialist', () => {
    const roster = makeRoster(45, { 0: 'GK', 1: 'MID' });

    expect(validateLacrosseRoster(makeTeam(roster))).toEqual({
      ok: false,
      error: ['Team maryland must roster at least one FOGO'],
    });
  });

  it('rejects scholarship usage above the D1 lacrosse cap', () => {
    expect(validateLacrosseRoster(makeTeam(makeRoster(), 12.7))).toEqual({
      ok: false,
      error: ['Team maryland exceeds D1 lacrosse scholarship cap: 12.7/12.6'],
    });
  });

  it('returns every roster problem it finds', () => {
    const roster = makeRoster(46, { 0: 'MID', 1: 'MID' });

    expect(validateLacrosseRoster(makeTeam(roster, 12.7))).toEqual({
      ok: false,
      error: [
        'Team maryland has 46 players; maximum is 45',
        'Team maryland must roster at least one GK',
        'Team maryland must roster at least one FOGO',
        'Team maryland exceeds D1 lacrosse scholarship cap: 12.7/12.6',
      ],
    });
  });
});
