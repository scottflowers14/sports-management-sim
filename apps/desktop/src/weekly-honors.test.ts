import { describe, expect, it } from 'vitest';
import type { LacrosseTeam } from '@sports-management-sim/sport-lacrosse';
import type { PlayerSeasonStats, SeasonStatsMap } from './stats';
import { pickWeeklyHonors, weeklyHonorCounts, weeklyHonorNews } from './weekly-honors';

function player(id: string, position: string) {
  return { id, position, name: { first: 'Pat', last: id.toUpperCase() } };
}

const teams = [
  { id: 'alpha', name: 'Alpha', roster: [player('a1', 'ATT'), player('a2', 'DEF'), player('a3', 'GK')] },
  { id: 'beta', name: 'Beta', roster: [player('b1', 'ATT'), player('b2', 'LSM'), player('b3', 'MID')] },
] as unknown as LacrosseTeam[];

function line(playerId: string, partial: Partial<PlayerSeasonStats>): PlayerSeasonStats {
  return {
    playerId,
    gamesPlayed: 1,
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
    ...partial,
  };
}

describe('pickWeeklyHonors', () => {
  it('judges only this week\'s production, not the season total', () => {
    const before: SeasonStatsMap = { a1: line('a1', { goals: 20 }) };
    const after: SeasonStatsMap = {
      a1: line('a1', { gamesPlayed: 2, goals: 21 }),
      b1: line('b1', { goals: 4, assists: 2 }),
      b3: line('b3', { goals: 3, assists: 3 }),
    };
    const honors = pickWeeklyHonors(3, before, after, teams);
    expect(honors.find((h) => h.kind === 'offense')).toEqual({ week: 3, kind: 'offense', playerId: 'b1', teamId: 'beta', line: '4G, 2A' });
  });

  it('names a defensive player from defensemen, LSMs and goalies only', () => {
    const after: SeasonStatsMap = {
      b3: line('b3', { causedTurnovers: 9, groundBalls: 9 }),
      a2: line('a2', { causedTurnovers: 3, groundBalls: 4 }),
      a3: line('a3', { saves: 18, goalsAllowed: 4 }),
    };
    const honors = pickWeeklyHonors(1, {}, after, teams);
    // 18 saves at 82% beats 3 CT + 4 GB; the midfielder can't win it.
    expect(honors.find((h) => h.kind === 'defense')).toMatchObject({ playerId: 'a3', line: '18 saves' });
  });

  it('gives a goalie nothing for a routine save rate', () => {
    const after: SeasonStatsMap = {
      a2: line('a2', { causedTurnovers: 1, groundBalls: 2 }),
      a3: line('a3', { saves: 20, goalsAllowed: 25 }),
    };
    expect(pickWeeklyHonors(1, {}, after, teams).find((h) => h.kind === 'defense')).toMatchObject({ playerId: 'a2' });
  });

  it('skips players who did not play this week', () => {
    const before: SeasonStatsMap = { a1: line('a1', { goals: 9 }) };
    const after: SeasonStatsMap = { a1: line('a1', { goals: 9 }) };
    expect(pickWeeklyHonors(2, before, after, teams)).toEqual([]);
  });
});

describe('weeklyHonorNews', () => {
  it('features honors won by the user\'s players', () => {
    const honors = [
      { week: 2, kind: 'offense' as const, playerId: 'a1', teamId: 'alpha', line: '5G, 1A' },
      { week: 2, kind: 'defense' as const, playerId: 'b2', teamId: 'beta', line: '4 CT, 6 GB' },
    ];
    const news = weeklyHonorNews(honors, teams, 'alpha');
    expect(news.map((n) => n.headline)).toEqual([
      'Player of the Week: ATT Pat A1 (Alpha), 5G, 1A',
      'Defensive Player of the Week: LSM Pat B2 (Beta), 4 CT, 6 GB',
    ]);
    expect(news.map((n) => n.featured ?? false)).toEqual([true, false]);
  });
});

describe('weeklyHonorCounts', () => {
  it('counts honors per player', () => {
    expect(weeklyHonorCounts([
      { week: 1, kind: 'offense', playerId: 'a1', teamId: 'alpha', line: '' },
      { week: 2, kind: 'offense', playerId: 'a1', teamId: 'alpha', line: '' },
      { week: 2, kind: 'defense', playerId: 'a3', teamId: 'alpha', line: '' },
    ])).toEqual({ a1: 2, a3: 1 });
  });
});
