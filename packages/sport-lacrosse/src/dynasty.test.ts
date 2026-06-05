import { describe, expect, it } from 'vitest';
import {
  advanceLacrosseDynastyWeek,
  createNewLacrosseDynasty,
  getLacrosseRecruitingSummary,
  offerLacrosseRecruitScholarship,
} from './dynasty';
import { validateLacrosseRoster } from './roster-validation';

describe('createNewLacrosseDynasty', () => {
  it('creates a deterministic playable lacrosse dynasty state from a seed', () => {
    const dynasty = createNewLacrosseDynasty({ seed: 2028, userTeamId: 'maryland-state', seasonYear: 2028 });
    const sameDynasty = createNewLacrosseDynasty({ seed: 2028, userTeamId: 'maryland-state', seasonYear: 2028 });

    expect(dynasty).toEqual(sameDynasty);
    expect(dynasty.id).toBe('lacrosse-dynasty-2028');
    expect(dynasty.seed).toBe(2028);
    expect(dynasty.userTeamId).toBe('maryland-state');
    expect(dynasty.season.year).toBe(2028);
    expect(dynasty.season.phase).toBe('regular_season');
    expect(dynasty.season.teams).toHaveLength(16);
    expect(dynasty.recruits).toHaveLength(80);
    expect(dynasty.recruitBoard.length).toBeGreaterThan(0);
    expect(dynasty.recruitBoard[0]?.recruit.id).toBeDefined();
  });

  it('creates valid lacrosse rosters and a complete schedule with 40 games across four conferences', () => {
    const dynasty = createNewLacrosseDynasty({ seed: 99, userTeamId: 'maryland-state', seasonYear: 2028 });

    expect(dynasty.season.teams.every((team) => validateLacrosseRoster(team).ok)).toBe(true);
    expect(dynasty.season.schedule).toHaveLength(40);
    expect(dynasty.season.schedule.every((game) => game.status === 'scheduled')).toBe(true);
    expect(dynasty.season.currentWeek).toBe(1);
  });

  it('throws when the requested user team is not in the generated universe', () => {
    expect(() =>
      createNewLacrosseDynasty({ seed: 2028, userTeamId: 'not-real', seasonYear: 2028 }),
    ).toThrow('Unknown lacrosse dynasty userTeamId: not-real');
  });
});

describe('offerLacrosseRecruitScholarship', () => {
  it('adds a scholarship offer, boosts interest, and keeps the original dynasty immutable', () => {
    const dynasty = createNewLacrosseDynasty({ seed: 2028, userTeamId: 'maryland-state', seasonYear: 2028 });
    const recruitId = dynasty.recruitBoard[0]?.recruit.id;

    expect(recruitId).toBeDefined();

    const offered = offerLacrosseRecruitScholarship(dynasty, recruitId as string);
    const originalRecruit = dynasty.recruits.find((recruit) => recruit.id === recruitId);
    const offeredRecruit = offered.recruits.find((recruit) => recruit.id === recruitId);

    expect(offered).not.toBe(dynasty);
    expect(originalRecruit?.scholarshipOffers).toEqual([]);
    expect(originalRecruit?.interestByTeamId['maryland-state']).toBeUndefined();
    expect(offeredRecruit?.scholarshipOffers).toEqual([{ teamId: 'maryland-state', scholarshipPercent: 100 }]);
    expect(offeredRecruit?.interestByTeamId['maryland-state']).toBeGreaterThan(0);
    expect(getLacrosseRecruitingSummary(offered)).toMatchObject({ offersUsed: 1, commitments: 0 });
  });

  it('resolves offered recruits into the user recruiting class as weeks advance', () => {
    const dynasty = createNewLacrosseDynasty({ seed: 2028, userTeamId: 'maryland-state', seasonYear: 2028 });
    const recruitId = dynasty.recruitBoard[0]?.recruit.id as string;
    const offered = offerLacrosseRecruitScholarship(dynasty, recruitId);

    const advanced = advanceLacrosseDynastyWeek(
      advanceLacrosseDynastyWeek(advanceLacrosseDynastyWeek(advanceLacrosseDynastyWeek(offered))),
    );
    const committedRecruit = advanced.recruits.find((recruit) => recruit.id === recruitId);

    expect(committedRecruit?.status).toBe('committed');
    expect(committedRecruit?.committedTeamId).toBe('maryland-state');
    expect(advanced.recruitingClass.map((recruit) => recruit.id)).toContain(recruitId);
    expect(advanced.recruitBoard.map((entry) => entry.recruit.id)).not.toContain(recruitId);
    expect(getLacrosseRecruitingSummary(advanced).commitments).toBe(1);
  });
});

describe('advanceLacrosseDynastyWeek', () => {
  it('simulates the current week and returns a new dynasty state', () => {
    const dynasty = createNewLacrosseDynasty({ seed: 2028, userTeamId: 'maryland-state', seasonYear: 2028 });

    const advanced = advanceLacrosseDynastyWeek(dynasty);

    expect(advanced).not.toBe(dynasty);
    expect(advanced.season).not.toBe(dynasty.season);
    expect(advanced.season.currentWeek).toBe(2);
    expect(advanced.season.schedule.filter((game) => game.week === 1)).toHaveLength(4);
    expect(advanced.season.schedule.filter((game) => game.week === 1 && game.status === 'final')).toHaveLength(4);
    expect(dynasty.season.schedule.filter((game) => game.week === 1 && game.status === 'scheduled')).toHaveLength(4);
    expect(advanced.season.standings).toHaveLength(16);

    const totalWins = advanced.season.teams.reduce((sum, team) => sum + team.record.wins, 0);
    const totalLosses = advanced.season.teams.reduce((sum, team) => sum + team.record.losses, 0);
    expect(totalWins).toBe(4);
    expect(totalLosses).toBe(4);
  });

  it('marks the season complete after the final scheduled week is simulated', () => {
    const dynasty = createNewLacrosseDynasty({ seed: 2028, userTeamId: 'maryland-state', seasonYear: 2028 });

    let completed = dynasty;
    for (let week = 1; week <= 14; week += 1) {
      completed = advanceLacrosseDynastyWeek(completed);
    }

    expect(completed.season.schedule.every((game) => game.status === 'final')).toBe(true);
    expect(completed.season.phase).toBe('complete');
  });
});
