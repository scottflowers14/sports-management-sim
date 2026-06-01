import { describe, expect, it } from 'vitest';
import type { LacrossePlayer, LacrosseTeam } from './models';

function makePlayer(index: number, scholarshipPercent: number): LacrossePlayer {
  return {
    id: `player-${index}`,
    name: { first: `Player`, last: `${index}` },
    age: 18,
    classYear: 'FR',
    hometown: 'Baltimore, MD',
    regionId: 'mid-atlantic',
    position: index === 0 ? 'FOGO' : 'MID',
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
      ...(index === 0 ? { faceoffs: 85 } : {}),
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

describe('Lacrosse models', () => {
  it('can represent a D1 roster with 45 players and a 12.6 scholarship cap', () => {
    const roster = Array.from({ length: 45 }, (_, index) => makePlayer(index, index < 42 ? 30 : 0));

    const team: LacrosseTeam = {
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
        scholarshipUsed: 12.6,
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

    expect(team.roster).toHaveLength(45);
    expect(team.resources.scholarshipLimit).toBe(12.6);
    expect(team.resources.scholarshipUsed).toBeLessThanOrEqual(team.resources.scholarshipLimit);
    expect(team.roster.some((player) => player.position === 'FOGO' && player.sportTraits.faceoffs === 85)).toBe(true);
  });
});
