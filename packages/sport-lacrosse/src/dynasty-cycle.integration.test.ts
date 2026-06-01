import {
  addSignedRecruitsToTeam,
  advanceSeasonWeek,
  analyzeRosterNeeds,
  applyScholarshipOffer,
  commitRecruit,
  createRoundRobinSchedule,
  runTeamOffseason,
  signCommittedRecruit,
  sortRecruitBoardForTeam,
  type Season,
} from '@sports-management-sim/engine-core';
import { describe, expect, it } from 'vitest';
import type { LacrossePlayer, LacrossePlayerTraits, LacrossePosition, LacrosseTeam } from './models';
import { generateLacrosseRecruitingClass } from './recruit-generation';
import { validateLacrosseRoster } from './roster-validation';
import { simulateLacrosseGame } from './simulate-game';
import { makeLacrossePlayer, makeLacrosseTeam, repeatingRandom } from './test-fixtures';

const LACROSSE_ROSTER_TARGETS: Record<LacrossePosition, number> = {
  ATT: 8,
  MID: 16,
  DEF: 10,
  GK: 4,
  FOGO: 3,
  LSM: 4,
};

describe('single-cycle lacrosse dynasty smoke test', () => {
  it('runs recruiting, signing, offseason, validation, schedule, and season simulation together', () => {
    const userTeam = makeRosterConstrainedTeam('user-team');
    const opponents = [makeLacrosseTeam('north'), makeLacrosseTeam('south'), makeLacrosseTeam('west')];

    const needs = analyzeRosterNeeds(userTeam, LACROSSE_ROSTER_TARGETS);
    expect(needs.find((need) => need.position === 'FOGO')).toMatchObject({ current: 1, target: 3, need: 2 });

    const recruits = generateLacrosseRecruitingClass({ count: 80, seed: 2028 });
    const recruitBoard = sortRecruitBoardForTeam(userTeam, recruits, LACROSSE_ROSTER_TARGETS);
    const targetRecruit = recruitBoard[0]?.recruit;

    expect(targetRecruit).toBeDefined();

    const offeredRecruit = applyScholarshipOffer(targetRecruit!, userTeam.id, 50);
    const committedRecruit = commitRecruit(offeredRecruit, [userTeam, ...opponents]);
    const signedRecruit = signCommittedRecruit(committedRecruit);

    expect(signedRecruit).toMatchObject({ status: 'signed', signedTeamId: userTeam.id });

    const teamWithSigningClass = addSignedRecruitsToTeam(userTeam, [signedRecruit], 2028);
    const nextUserTeam = runTeamOffseason(teamWithSigningClass, { developmentRandom: repeatingRandom(0.5) });

    expect(nextUserTeam.roster.some((player) => player.id === `player-from-${signedRecruit.id}`)).toBe(true);
    expect(nextUserTeam.roster.every((player) => player.classYear !== 'GR')).toBe(true);
    expect(validateLacrosseRoster(nextUserTeam).ok).toBe(true);

    const seasonTeams: LacrosseTeam[] = [nextUserTeam, ...opponents];
    const schedule = createRoundRobinSchedule(
      seasonTeams.map((team) => team.id),
      2028,
    );

    let season: Season<LacrossePosition, LacrossePlayerTraits> = {
      year: 2028,
      teams: seasonTeams,
      conferences: [
        {
          id: 'conference-1',
          name: 'Test Conference',
          shortName: 'TC',
          teamIds: seasonTeams.map((team) => team.id),
          prestige: 50,
          regionIds: ['mid-atlantic'],
        },
      ],
      regions: [
        {
          id: 'mid-atlantic',
          name: 'Mid-Atlantic',
          country: 'USA',
          recruitingHotbedScore: 95,
        },
      ],
      schedule,
      standings: [],
      currentWeek: 1,
      phase: 'regular_season',
    };

    for (let week = 0; week < schedule.length; week += 1) {
      season = advanceSeasonWeek(season, (_game, homeTeam, awayTeam) =>
        simulateLacrosseGame({ homeTeam, awayTeam, random: repeatingRandom(0.5) }),
      );
    }

    expect(season.schedule.every((game) => game.status === 'final')).toBe(true);
    expect(season.teams.every((team) => team.record.wins + team.record.losses === 3)).toBe(true);
    expect(season.standings).toHaveLength(4);
  });
});

function makeRosterConstrainedTeam(id: string): LacrosseTeam {
  const roster: LacrossePlayer[] = [
    makeLacrossePlayer(1, 'GK', 25),
    makeLacrossePlayer(2, 'FOGO', 25),
    makeLacrossePlayer(3, 'ATT', 25),
    makeLacrossePlayer(4, 'ATT', 25),
    makeLacrossePlayer(5, 'MID', 25),
    makeLacrossePlayer(6, 'MID', 25),
    makeLacrossePlayer(7, 'MID', 25),
    makeLacrossePlayer(8, 'DEF', 25),
    makeLacrossePlayer(9, 'DEF', 25),
    makeLacrossePlayer(10, 'LSM', 25),
    makeSenior(11, 'MID', 25),
  ];

  return {
    ...makeLacrosseTeam(id),
    roster,
    resources: {
      scholarshipLimit: 12.6,
      scholarshipUsed: 2.75,
      recruitingBudget: 100_000,
      staffBudget: 250_000,
      facilitiesBudget: 500_000,
    },
  };
}

function makeSenior(index: number, position: LacrossePosition, scholarshipPercent: number): LacrossePlayer {
  return {
    ...makeLacrossePlayer(index, position, scholarshipPercent),
    classYear: 'SR',
  };
}
