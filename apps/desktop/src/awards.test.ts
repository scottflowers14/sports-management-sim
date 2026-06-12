import { describe, expect, it } from 'vitest';
import type { LacrosseSeason } from '@sports-management-sim/sport-lacrosse';
import { computeSeasonAwards } from './awards';
import { emptySeasonStats } from './stats';
import type { SeasonStatsMap } from './stats';

function makePlayer(id: string, position: string, overall = 60, classYear = 'JR') {
  const num = id.replace(/\D/g, '');
  return {
    id,
    name: { first: 'Player', last: num },
    position,
    classYear,
    ratings: { overall },
  };
}

function makeSeason(): LacrosseSeason {
  const alpha = {
    id: 'alpha',
    name: 'Alpha University',
    record: { wins: 10, losses: 2 },
    roster: [
      makePlayer('player-0', 'GK'),
      makePlayer('player-1', 'FOGO'),
      makePlayer('player-2', 'ATT', 70),
      makePlayer('player-3', 'MID'),
      makePlayer('player-4', 'DEF'),
      makePlayer('player-5', 'LSM'),
    ],
  };
  const beta = {
    id: 'beta',
    name: 'Beta College',
    record: { wins: 2, losses: 10 },
    roster: [
      makePlayer('player-10', 'GK'),
      makePlayer('player-11', 'FOGO'),
      makePlayer('player-12', 'ATT'),
      makePlayer('player-13', 'MID'),
      makePlayer('player-14', 'DEF', 65, 'FR'),
    ],
  };

  return { id: 'season-1', year: 2030, teams: [alpha, beta] } as unknown as LacrosseSeason;
}

function statsFor(entries: Array<[string, Partial<SeasonStatsMap[string]>]>): SeasonStatsMap {
  const map = emptySeasonStats();
  for (const [playerId, partial] of entries) {
    map[playerId] = {
      playerId,
      gamesPlayed: 12,
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
  return map;
}

describe('computeSeasonAwards (stat-based)', () => {
  it('picks MVP and offensive player from production, weighted toward winners', () => {
    const season = makeSeason();
    const stats = statsFor([
      // ATT on the 10-win team: big production
      ['player-2', { goals: 40, assists: 18 }],
      // ATT on the 2-win team: slightly more points but a losing team
      ['player-12', { goals: 41, assists: 19 }],
      ['player-3', { goals: 10, assists: 5 }],
    ]);

    const awards = computeSeasonAwards(season, 'alpha', stats);

    expect(awards.mvp.playerName).toBe('Player 2');
    expect(awards.mvp.statLine).toBe('40G, 18A');
    // Offensive POY is pure production — the losing team's attackman wins it
    expect(awards.offensivePlayer.playerName).toBe('Player 12');
  });

  it('picks the defensive player from caused turnovers or goalie saves', () => {
    const season = makeSeason();
    const stats = statsFor([
      ['player-2', { goals: 20 }],
      ['player-4', { causedTurnovers: 30, groundBalls: 40 }],
      ['player-0', { saves: 10, goalsAllowed: 30 }],
    ]);

    const awards = computeSeasonAwards(season, 'alpha', stats);

    expect(awards.defensivePlayer.playerName).toBe('Player 4');
    expect(awards.defensivePlayer.statLine).toBe('30 CT, 40 GB');
  });

  it('awards freshman of the year to an underclassman with production', () => {
    const season = makeSeason();
    const stats = statsFor([
      ['player-2', { goals: 30 }],
      ['player-14', { goals: 8, assists: 4 }],
    ]);

    const awards = computeSeasonAwards(season, 'alpha', stats);

    expect(awards.freshmanOfYear?.playerName).toBe('Player 14');
    expect(awards.freshmanOfYear?.statLine).toBe('8G, 4A');
  });

  it('builds an all-conference team across all six positions with stat lines', () => {
    const season = makeSeason();
    const stats = statsFor([
      ['player-2', { goals: 30, assists: 10 }],
      ['player-3', { goals: 20, assists: 15 }],
      ['player-4', { causedTurnovers: 25, groundBalls: 30 }],
      ['player-5', { causedTurnovers: 10, groundBalls: 20 }],
      ['player-0', { saves: 120, goalsAllowed: 80 }],
      ['player-1', { faceoffWins: 150, faceoffAttempts: 250 }],
    ]);

    const awards = computeSeasonAwards(season, 'alpha', stats);
    const positions = awards.allConference.map((w) => w.position);

    expect(positions).toEqual(expect.arrayContaining(['ATT', 'MID', 'DEF', 'LSM', 'GK', 'FOGO']));
    const fogo = awards.allConference.find((w) => w.position === 'FOGO')!;
    expect(fogo.statLine).toBe('150 FO wins (60%)');
  });

  it('falls back to rating-based awards when no stats exist', () => {
    const season = makeSeason();

    const withEmpty = computeSeasonAwards(season, 'alpha', emptySeasonStats());
    const withUndefined = computeSeasonAwards(season, 'alpha');

    expect(withEmpty.mvp.statLine).toBeUndefined();
    expect(withEmpty.mvp.playerName).toBe(withUndefined.mvp.playerName);
    // Rating-based MVP comes from the winningest team
    expect(withEmpty.mvp.teamName).toBe('Alpha University');
  });
});
