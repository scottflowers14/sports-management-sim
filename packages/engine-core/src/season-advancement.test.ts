import { describe, expect, it } from 'vitest';
import type { GameResult, Season, Team } from './models';
import { advanceSeasonWeek } from './season-advancement';

function makeTeam(id: string): Team<'GENERIC'> {
  return {
    id,
    name: `${id} University`,
    shortName: id,
    schoolName: `${id} University`,
    conferenceId: 'conference-1',
    regionId: 'region-1',
    reputation: {
      nationalPrestige: 50,
      academicPrestige: 50,
      coachingPrestige: 50,
      facilities: 50,
      fanSupport: 50,
      recentSuccess: 50,
    },
    resources: {
      scholarshipLimit: 12.6,
      scholarshipUsed: 12.6,
      recruitingBudget: 100_000,
      staffBudget: 250_000,
      facilitiesBudget: 500_000,
    },
    roster: [],
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

function makeSeason(): Season<'GENERIC'> {
  const teams = [makeTeam('a'), makeTeam('b'), makeTeam('c'), makeTeam('d')];

  return {
    year: 2027,
    teams,
    conferences: [
      {
        id: 'conference-1',
        name: 'Test Conference',
        shortName: 'TC',
        teamIds: teams.map((team) => team.id),
        prestige: 50,
        regionIds: ['region-1'],
      },
    ],
    regions: [
      {
        id: 'region-1',
        name: 'Test Region',
        country: 'USA',
        recruitingHotbedScore: 50,
      },
    ],
    schedule: [
      {
        id: 'game-1',
        seasonYear: 2027,
        week: 1,
        homeTeamId: 'a',
        awayTeamId: 'b',
        conferenceGame: true,
        status: 'scheduled',
      },
      {
        id: 'game-2',
        seasonYear: 2027,
        week: 2,
        homeTeamId: 'c',
        awayTeamId: 'd',
        conferenceGame: false,
        status: 'scheduled',
      },
    ],
    standings: [],
    currentWeek: 1,
    phase: 'regular_season',
  };
}

const homeWin = (): GameResult => ({
  homeScore: 10,
  awayScore: 8,
  winnerTeamId: 'a',
  loserTeamId: 'b',
  overtime: false,
});

describe('advanceSeasonWeek', () => {
  it('finalizes scheduled games in the current week', () => {
    const nextSeason = advanceSeasonWeek(makeSeason(), homeWin);

    expect(nextSeason.schedule[0]?.status).toBe('final');
    expect(nextSeason.schedule[0]?.result).toEqual(homeWin());
  });

  it('leaves future games scheduled', () => {
    const nextSeason = advanceSeasonWeek(makeSeason(), homeWin);

    expect(nextSeason.schedule[1]?.status).toBe('scheduled');
    expect(nextSeason.schedule[1]?.result).toBeUndefined();
  });

  it('increments the current week', () => {
    const nextSeason = advanceSeasonWeek(makeSeason(), homeWin);

    expect(nextSeason.currentWeek).toBe(2);
  });

  it('updates team records for game results', () => {
    const nextSeason = advanceSeasonWeek(makeSeason(), homeWin);
    const winner = nextSeason.teams.find((team) => team.id === 'a');
    const loser = nextSeason.teams.find((team) => team.id === 'b');

    expect(winner?.record).toMatchObject({ wins: 1, losses: 0, conferenceWins: 1, homeWins: 1 });
    expect(loser?.record).toMatchObject({ wins: 0, losses: 1, conferenceLosses: 1, awayLosses: 1 });
  });

  it('does not mutate the input season', () => {
    const season = makeSeason();
    const nextSeason = advanceSeasonWeek(season, homeWin);

    expect(nextSeason).not.toBe(season);
    expect(season.schedule[0]?.status).toBe('scheduled');
    expect(season.teams[0]?.record.wins).toBe(0);
  });
});
