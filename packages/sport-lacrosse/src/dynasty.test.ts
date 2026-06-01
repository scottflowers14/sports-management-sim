import { describe, expect, it } from 'vitest';
import { createNewLacrosseDynasty } from './dynasty';
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
    expect(dynasty.season.teams).toHaveLength(4);
    expect(dynasty.recruits).toHaveLength(80);
    expect(dynasty.recruitBoard.length).toBeGreaterThan(0);
    expect(dynasty.recruitBoard[0]?.recruit.id).toBeDefined();
  });

  it('creates valid lacrosse rosters and a complete four-team round-robin schedule', () => {
    const dynasty = createNewLacrosseDynasty({ seed: 99, userTeamId: 'maryland-state', seasonYear: 2028 });

    expect(dynasty.season.teams.every((team) => validateLacrosseRoster(team).ok)).toBe(true);
    expect(dynasty.season.schedule).toHaveLength(6);
    expect(dynasty.season.schedule.every((game) => game.status === 'scheduled')).toBe(true);
    expect(new Set(dynasty.season.schedule.map((game) => game.week)).size).toBe(6);
  });

  it('throws when the requested user team is not in the generated universe', () => {
    expect(() =>
      createNewLacrosseDynasty({ seed: 2028, userTeamId: 'not-real', seasonYear: 2028 }),
    ).toThrow('Unknown lacrosse dynasty userTeamId: not-real');
  });
});
