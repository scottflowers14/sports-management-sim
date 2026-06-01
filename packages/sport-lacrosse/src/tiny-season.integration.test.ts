import { advanceSeasonWeek, createRoundRobinSchedule, type Season } from '@sports-management-sim/engine-core';
import { describe, expect, it } from 'vitest';
import { simulateLacrosseGame } from './simulate-game';
import { makeLacrosseTeam, repeatingRandom } from './test-fixtures';
import type { LacrossePosition, LacrossePlayerTraits } from './models';

describe('tiny lacrosse season integration', () => {
  it('runs a four-team round-robin season to completion', () => {
    const teams = [
      makeLacrosseTeam('alpha'),
      makeLacrosseTeam('bravo'),
      makeLacrosseTeam('charlie'),
      makeLacrosseTeam('delta'),
    ];

    const schedule = createRoundRobinSchedule(
      teams.map((team) => team.id),
      2027,
    );

    let season: Season<LacrossePosition, LacrossePlayerTraits> = {
      year: 2027,
      teams,
      conferences: [
        {
          id: 'conference-1',
          name: 'Test Conference',
          shortName: 'TC',
          teamIds: teams.map((team) => team.id),
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
    expect(season.standings.map((entry) => entry.teamId).sort()).toEqual(['alpha', 'bravo', 'charlie', 'delta']);
  });
});
