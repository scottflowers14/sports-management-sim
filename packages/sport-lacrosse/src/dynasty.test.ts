import { describe, expect, it } from 'vitest';
import { advanceLacrosseDynastyWeek, createNewLacrosseDynasty } from './dynasty';
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
    expect(dynasty.season.teams).toHaveLength(8);
    expect(dynasty.recruits).toHaveLength(80);
    expect(dynasty.recruitBoard.length).toBeGreaterThan(0);
    expect(dynasty.recruitBoard[0]?.recruit.id).toBeDefined();
  });

  it('creates valid lacrosse rosters and a complete schedule with 20 games across two conferences', () => {
    const dynasty = createNewLacrosseDynasty({ seed: 99, userTeamId: 'maryland-state', seasonYear: 2028 });

    expect(dynasty.season.teams.every((team) => validateLacrosseRoster(team).ok)).toBe(true);
    expect(dynasty.season.schedule).toHaveLength(20);
    expect(dynasty.season.schedule.every((game) => game.status === 'scheduled')).toBe(true);
    expect(dynasty.season.currentWeek).toBe(1);
  });

  it('throws when the requested user team is not in the generated universe', () => {
    expect(() =>
      createNewLacrosseDynasty({ seed: 2028, userTeamId: 'not-real', seasonYear: 2028 }),
    ).toThrow('Unknown lacrosse dynasty userTeamId: not-real');
  });
});

describe('advanceLacrosseDynastyWeek', () => {
  it('simulates the current week and returns a new dynasty state', () => {
    const dynasty = createNewLacrosseDynasty({ seed: 2028, userTeamId: 'maryland-state', seasonYear: 2028 });

    const advanced = advanceLacrosseDynastyWeek(dynasty);

    expect(advanced).not.toBe(dynasty);
    expect(advanced.season).not.toBe(dynasty.season);
    expect(advanced.season.currentWeek).toBe(2);
    expect(advanced.season.schedule.filter((game) => game.week === 1)).toHaveLength(1);
    expect(advanced.season.schedule.filter((game) => game.week === 1 && game.status === 'final')).toHaveLength(1);
    expect(dynasty.season.schedule.filter((game) => game.week === 1 && game.status === 'scheduled')).toHaveLength(1);
    expect(advanced.season.standings).toHaveLength(4);

    const totalWins = advanced.season.teams.reduce((sum, team) => sum + team.record.wins, 0);
    const totalLosses = advanced.season.teams.reduce((sum, team) => sum + team.record.losses, 0);
    expect(totalWins).toBe(1);
    expect(totalLosses).toBe(1);
  });

  it('marks the season complete after the final scheduled week is simulated', () => {
    const dynasty = createNewLacrosseDynasty({ seed: 2028, userTeamId: 'maryland-state', seasonYear: 2028 });

    const completed = advanceLacrosseDynastyWeek(
      advanceLacrosseDynastyWeek(advanceLacrosseDynastyWeek(advanceLacrosseDynastyWeek(advanceLacrosseDynastyWeek(advanceLacrosseDynastyWeek(dynasty))))),
    );

    expect(completed.season.schedule.every((game) => game.status === 'final')).toBe(true);
    expect(completed.season.phase).toBe('complete');
  });
});
