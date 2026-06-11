import { describe, expect, it } from 'vitest';
import type { Player, Team } from './models';
import { advancePlayerClass, progressPlayer, runTeamOffseason } from './offseason';

function makePlayer(id: string, classYear: Player['classYear'], overrides: Partial<Player<'GENERIC'>> = {}): Player<'GENERIC'> {
  return {
    id,
    name: { first: 'Player', last: id },
    age: 20,
    classYear,
    hometown: 'Baltimore, MD',
    regionId: 'mid-atlantic',
    position: 'GENERIC',
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
    scholarshipPercent: 50,
    isWalkOn: false,
    morale: 50,
    health: 100,
    fatigue: 20,
    redshirtStatus: 'none',
    eligibility: {
      seasonsPlayed: 0,
      seasonsRemaining: 4,
      isEligible: true,
    },
    createdSeason: 2027,
    ...overrides,
  };
}

function makeTeam(roster: Player<'GENERIC'>[]): Team<'GENERIC'> {
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
      scholarshipUsed: roster.reduce((sum, player) => sum + player.scholarshipPercent / 100, 0),
      recruitingBudget: 100_000,
      staffBudget: 250_000,
      facilitiesBudget: 500_000,
    },
    roster,
    record: {
      wins: 10,
      losses: 5,
      conferenceWins: 4,
      conferenceLosses: 2,
      homeWins: 5,
      homeLosses: 2,
      awayWins: 5,
      awayLosses: 3,
      neutralWins: 0,
      neutralLosses: 0,
    },
    createdSeason: 2027,
  };
}

describe('offseason progression', () => {
  it('advances player classes and returns null for graduating seniors', () => {
    expect(advancePlayerClass('FR')).toBe('SO');
    expect(advancePlayerClass('SO')).toBe('JR');
    expect(advancePlayerClass('JR')).toBe('SR');
    expect(advancePlayerClass('SR')).toBeNull();
    expect(advancePlayerClass('GR')).toBeNull();
  });

  it('progresses a player toward potential without mutating the original', () => {
    const player = makePlayer('p1', 'SO', {
      ratings: {
        ...makePlayer('base', 'SO').ratings,
        overall: 60,
        potential: 75,
        workEthic: 90,
      },
    });

    const progressed = progressPlayer(player, 0.5);

    expect(progressed).not.toBe(player);
    expect(progressed.ratings.overall).toBeGreaterThan(player.ratings.overall);
    expect(progressed.ratings.overall).toBeLessThanOrEqual(player.ratings.potential);
    expect(player.ratings.overall).toBe(60);
  });

  it('does not progress a player beyond potential', () => {
    const player = makePlayer('p1', 'SO', {
      ratings: {
        ...makePlayer('base', 'SO').ratings,
        overall: 74,
        potential: 75,
        workEthic: 100,
      },
    });

    expect(progressPlayer(player, 1).ratings.overall).toBe(75);
  });

  it('regresses a player at potential ceiling on low development roll', () => {
    const player = makePlayer('p1', 'SR', {
      ratings: {
        ...makePlayer('base', 'SR').ratings,
        overall: 80,
        potential: 80,
        workEthic: 50,
      },
    });

    const regressed = progressPlayer(player, 0.0);
    expect(regressed.ratings.overall).toBe(79);
    // Attributes should also drop by 1
    expect(regressed.ratings.speed).toBe(player.ratings.speed - 1);
    expect(regressed.ratings.skill).toBe(player.ratings.skill - 1);
  });

  it('does not regress a player at potential ceiling on high development roll with high work ethic', () => {
    const player = makePlayer('p1', 'SR', {
      ratings: {
        ...makePlayer('base', 'SR').ratings,
        overall: 80,
        potential: 80,
        workEthic: 100,
      },
    });

    const result = progressPlayer(player, 0.95);
    expect(result.ratings.overall).toBe(80);
  });

  it('graduates seniors, advances classes, resets fatigue, updates eligibility, and recalculates scholarships', () => {
    const freshman = makePlayer('freshman', 'FR', { scholarshipPercent: 25 });
    const junior = makePlayer('junior', 'JR', { scholarshipPercent: 50 });
    const senior = makePlayer('senior', 'SR', { scholarshipPercent: 100 });
    const team = makeTeam([freshman, junior, senior]);

    const nextTeam = runTeamOffseason(team, { developmentRandom: () => 0.5 });

    expect(nextTeam).not.toBe(team);
    expect(nextTeam.roster.map((player) => player.id)).toEqual(['freshman', 'junior']);
    expect(nextTeam.roster.map((player) => player.classYear)).toEqual(['SO', 'SR']);
    expect(nextTeam.roster.every((player) => player.fatigue === 0)).toBe(true);
    expect(nextTeam.roster.every((player) => player.eligibility.seasonsPlayed === 1)).toBe(true);
    expect(nextTeam.resources.scholarshipUsed).toBe(0.75);
    expect(nextTeam.record.wins).toBe(0);
    expect(nextTeam.record.losses).toBe(0);
  });

  it('applies a development bonus to matching players only', () => {
    const focused = makePlayer('focused', 'FR', {
      position: 'GENERIC',
      ratings: { ...makePlayer('base', 'FR').ratings, overall: 60, potential: 80, workEthic: 60 },
    });
    const team = makeTeam([focused]);

    const withoutBonus = runTeamOffseason(team, { developmentRandom: () => 0.2 });
    const withBonus = runTeamOffseason(team, {
      developmentRandom: () => 0.2,
      developmentBonusFor: (player) => (player.id === 'focused' ? 0.5 : 0),
    });
    const withNonMatchingBonus = runTeamOffseason(team, {
      developmentRandom: () => 0.2,
      developmentBonusFor: (player) => (player.id === 'someone-else' ? 0.5 : 0),
    });

    expect(withBonus.roster[0]!.ratings.overall).toBeGreaterThan(withoutBonus.roster[0]!.ratings.overall);
    expect(withNonMatchingBonus.roster[0]!.ratings.overall).toBe(withoutBonus.roster[0]!.ratings.overall);
  });

  it('clamps the boosted development roll so progression never exceeds potential', () => {
    const nearCeiling = makePlayer('near-ceiling', 'FR', {
      ratings: { ...makePlayer('base', 'FR').ratings, overall: 79, potential: 80, workEthic: 100 },
    });
    const team = makeTeam([nearCeiling]);

    const result = runTeamOffseason(team, {
      developmentRandom: () => 0.9,
      developmentBonusFor: () => 0.5,
    });

    expect(result.roster[0]!.ratings.overall).toBe(80);
  });
});
