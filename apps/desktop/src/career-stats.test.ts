import { describe, expect, it } from 'vitest';
import { careerTotals, emptyCareerStats, recordSeasonToCareer } from './career-stats';
import type { SeasonStatsMap } from './stats';
import type { LacrosseTeam } from '@sports-management-sim/sport-lacrosse';

function team(id: string, roster: Array<{ id: string; first: string; last: string; position: string; classYear: string }>): LacrosseTeam {
  return {
    id,
    name: id,
    roster: roster.map((p) => ({
      id: p.id,
      name: { first: p.first, last: p.last },
      position: p.position,
      classYear: p.classYear,
    })),
  } as unknown as LacrosseTeam;
}

function line(playerId: string, over: Partial<SeasonStatsMap[string]>): SeasonStatsMap[string] {
  return {
    playerId,
    gamesPlayed: 0,
    goals: 0,
    assists: 0,
    shots: 0,
    groundBalls: 0,
    turnovers: 0,
    causedTurnovers: 0,
    faceoffWins: 0,
    faceoffAttempts: 0,
    saves: 0,
    goalsAllowed: 0,
    ...over,
  };
}

describe('recordSeasonToCareer', () => {
  it('accumulates a season line per player who played', () => {
    const teams = [
      team('maryland-state', [
        { id: 'p1', first: 'Ryan', last: 'Walsh', position: 'ATT', classYear: 'FR' },
        { id: 'p2', first: 'Bench', last: 'Guy', position: 'MID', classYear: 'FR' },
      ]),
    ];
    const stats: SeasonStatsMap = {
      p1: line('p1', { gamesPlayed: 14, goals: 20, assists: 10 }),
      p2: line('p2', { gamesPlayed: 0 }),
    };

    const career = recordSeasonToCareer(emptyCareerStats(), stats, teams, 2026);
    expect(Object.keys(career)).toEqual(['p1']);
    expect(career.p1!.seasons).toHaveLength(1);
    expect(career.p1!.seasons[0]!.year).toBe(2026);
    expect(career.p1!.seasons[0]!.classYear).toBe('FR');
  });

  it('appends across multiple seasons keyed by player id', () => {
    const fr = [team('maryland-state', [{ id: 'p1', first: 'Ryan', last: 'Walsh', position: 'ATT', classYear: 'FR' }])];
    const so = [team('maryland-state', [{ id: 'p1', first: 'Ryan', last: 'Walsh', position: 'ATT', classYear: 'SO' }])];

    let career = recordSeasonToCareer(emptyCareerStats(), { p1: line('p1', { gamesPlayed: 14, goals: 20 }) }, fr, 2026);
    career = recordSeasonToCareer(career, { p1: line('p1', { gamesPlayed: 15, goals: 30 }) }, so, 2027);

    expect(career.p1!.seasons.map((s) => s.year)).toEqual([2026, 2027]);
    expect(careerTotals(career.p1).goals).toBe(50);
  });

  it('is idempotent when the same season is recorded twice', () => {
    const teams = [team('maryland-state', [{ id: 'p1', first: 'Ryan', last: 'Walsh', position: 'ATT', classYear: 'FR' }])];
    const stats: SeasonStatsMap = { p1: line('p1', { gamesPlayed: 14, goals: 20 }) };

    let career = recordSeasonToCareer(emptyCareerStats(), stats, teams, 2026);
    career = recordSeasonToCareer(career, stats, teams, 2026);

    expect(career.p1!.seasons).toHaveLength(1);
    expect(careerTotals(career.p1).goals).toBe(20);
  });
});

describe('careerTotals', () => {
  it('folds the in-progress season into the totals', () => {
    const teams = [team('maryland-state', [{ id: 'p1', first: 'Ryan', last: 'Walsh', position: 'ATT', classYear: 'JR' }])];
    const career = recordSeasonToCareer(emptyCareerStats(), { p1: line('p1', { gamesPlayed: 14, goals: 20 }) }, teams, 2027);

    const totals = careerTotals(career.p1, line('p1', { gamesPlayed: 6, goals: 12 }));
    expect(totals.goals).toBe(32);
    expect(totals.gamesPlayed).toBe(20);
  });

  it('returns zeros for an unknown player', () => {
    expect(careerTotals(undefined).goals).toBe(0);
  });
});
