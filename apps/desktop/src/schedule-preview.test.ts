import { describe, expect, it } from 'vitest';
import { createNewLacrosseDynasty } from '@sports-management-sim/sport-lacrosse';
import { getNextUserGamePreview } from './schedule-preview';

describe('getNextUserGamePreview', () => {
  it('returns the next unsimmed user matchup with rating edges', () => {
    const dynasty = createNewLacrosseDynasty({ seed: 11, seasonYear: 2028, userTeamId: 'maryland-state' });
    const preview = getNextUserGamePreview({
      schedule: dynasty.season.schedule,
      teams: dynasty.season.teams,
      userTeamId: dynasty.userTeamId,
      currentWeek: dynasty.season.currentWeek,
    });

    expect(preview).not.toBeNull();
    expect(preview?.game.week).toBeGreaterThanOrEqual(dynasty.season.currentWeek);
    expect(preview?.userTeam.id).toBe(dynasty.userTeamId);
    expect(preview?.opponent.id).not.toBe(dynasty.userTeamId);
    expect(preview?.ratingEdge).toBe(preview!.userRating.overall - preview!.opponentRating.overall);
    expect(preview?.matchupNote).toEqual(expect.any(String));
  });

  it('skips completed user games', () => {
    const dynasty = createNewLacrosseDynasty({ seed: 12, seasonYear: 2028, userTeamId: 'maryland-state' });
    const firstUserGame = dynasty.season.schedule.find(
      (game) => game.homeTeamId === dynasty.userTeamId || game.awayTeamId === dynasty.userTeamId,
    );
    expect(firstUserGame).toBeTruthy();

    const schedule = dynasty.season.schedule.map((game) =>
      game.id === firstUserGame?.id
        ? {
            ...game,
            result: {
              homeScore: 10,
              awayScore: 9,
              winnerTeamId: game.homeTeamId,
              loserTeamId: game.awayTeamId,
              overtime: false,
            },
          }
        : game,
    );

    const preview = getNextUserGamePreview({
      schedule,
      teams: dynasty.season.teams,
      userTeamId: dynasty.userTeamId,
      currentWeek: dynasty.season.currentWeek,
    });

    expect(preview?.game.id).not.toBe(firstUserGame?.id);
  });
});
