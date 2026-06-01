import type { LacrossePlayer, LacrossePosition, LacrosseTeam } from './models';

export function makeLacrossePlayer(index: number, position: LacrossePosition, scholarshipPercent = 0): LacrossePlayer {
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
      ...(position === 'GK' ? { goalieReflexes: 75, goaliePositioning: 72, goalieClearing: 65 } : {}),
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

export function makeLacrosseRoster(size = 45): LacrossePlayer[] {
  return Array.from({ length: size }, (_, index) => {
    const position: LacrossePosition = index === 0 ? 'GK' : index === 1 ? 'FOGO' : 'MID';
    return makeLacrossePlayer(index, position, index < 42 ? 30 : 0);
  });
}

export function makeLacrosseTeam(id: string, roster = makeLacrosseRoster()): LacrosseTeam {
  return {
    id,
    name: `${id} University`,
    shortName: id,
    schoolName: `${id} University`,
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
}

export function repeatingRandom(value: number): () => number {
  return () => value;
}
