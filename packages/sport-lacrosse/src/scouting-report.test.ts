import { describe, expect, it } from 'vitest';
import type { ScheduledGame } from '@sports-management-sim/engine-core';
import type { LacrosseTeamStats } from './models';
import { DEFAULT_GAME_PLAN } from './game-plan';
import {
  SCOUT_MIN_GAMES,
  leagueTendencies,
  scoutedGamePlan,
  scoutingKeys,
  teamTendencies,
  type TeamTendencies,
} from './scouting-report';

function box(over: Partial<LacrosseTeamStats> = {}): LacrosseTeamStats {
  return {
    goals: 10,
    shots: 35,
    shotsOnGoal: 22,
    assists: 5,
    turnovers: 13,
    causedTurnovers: 8,
    groundBalls: 30,
    faceoffWins: 12,
    faceoffAttempts: 24,
    saves: 12,
    clears: 17,
    clearAttempts: 20,
    penalties: 2,
    penaltyMinutes: 2,
    ...over,
  };
}

let n = 0;
function game(homeTeamId: string, awayTeamId: string, home: LacrosseTeamStats, away: LacrosseTeamStats): ScheduledGame {
  const homeWon = home.goals > away.goals;
  return {
    id: `g${n++}`,
    seasonYear: 2026,
    week: 1,
    homeTeamId,
    awayTeamId,
    conferenceGame: false,
    status: 'final',
    result: {
      homeScore: home.goals,
      awayScore: away.goals,
      winnerTeamId: homeWon ? homeTeamId : awayTeamId,
      loserTeamId: homeWon ? awayTeamId : homeTeamId,
      overtime: false,
      teamStats: { home, away },
    },
  };
}

const norm: TeamTendencies = {
  games: 20,
  goalsFor: 11,
  goalsAgainst: 11,
  shots: 38,
  shootingPct: 0.3,
  faceoffPct: 0.5,
  clearPct: 0.85,
  turnovers: 13,
  causedTurnovers: 9,
  penalties: 2,
};

describe('team tendencies', () => {
  it('averages a team from both sides of its box scores', () => {
    const schedule = [
      game('a', 'b', box({ goals: 12, shots: 40, faceoffWins: 15, faceoffAttempts: 25 }), box({ goals: 8, faceoffWins: 10, faceoffAttempts: 25 })),
      game('c', 'a', box({ goals: 9 }), box({ goals: 14, shots: 30, faceoffWins: 13, faceoffAttempts: 25, clears: 15, clearAttempts: 20 })),
      (({ result: _r, ...g }) => ({ ...g, status: 'scheduled' as const }))(game('a', 'd', box(), box())),
    ];
    const t = teamTendencies(schedule, 'a')!;
    expect(t.games).toBe(2);
    expect(t.goalsFor).toBe(13);
    expect(t.goalsAgainst).toBe(8.5);
    expect(t.shootingPct).toBeCloseTo(26 / 70);
    expect(t.faceoffPct).toBeCloseTo(28 / 50);
    expect(t.clearPct).toBeCloseTo(32 / 40);
    expect(teamTendencies(schedule, 'nobody')).toBeNull();
  });

  it('builds a league baseline from every team-game', () => {
    const schedule = [game('a', 'b', box({ goals: 12 }), box({ goals: 8 })), game('c', 'd', box({ goals: 10 }), box({ goals: 6 }))];
    const lg = leagueTendencies(schedule)!;
    expect(lg.games).toBe(4);
    expect(lg.goalsFor).toBe(9);
    expect(lg.goalsAgainst).toBe(9);
    expect(lg.faceoffPct).toBeCloseTo(0.5);
    expect(leagueTendencies([])).toBeNull();
  });
});

describe('scouting keys', () => {
  it('turns tendencies well off the norm into plan adjustments', () => {
    const keys = scoutingKeys({ ...norm, faceoffPct: 0.62, clearPct: 0.76, turnovers: 16 }, norm);
    expect(keys.map((k) => [k.axis, k.value])).toEqual(
      expect.arrayContaining([
        ['tempo', 'patient'],
        ['ride', 'aggressive'],
        ['defense', 'pressure'],
      ]),
    );
    expect(keys.find((k) => k.axis === 'tempo')!.note).toContain('62%');
    for (let i = 1; i < keys.length; i += 1) expect(keys[i - 1]!.strength).toBeGreaterThanOrEqual(keys[i]!.strength);
  });

  it('keeps one key per axis, the strongest, and at most three', () => {
    // A great shooting team that also turns it over a lot: both are defense keys.
    const keys = scoutingKeys({ ...norm, shootingPct: 0.4, turnovers: 15.5, goalsFor: 14, penalties: 4, goalsAgainst: 14 }, norm);
    expect(keys.length).toBeLessThanOrEqual(3);
    expect(new Set(keys.map((k) => k.axis)).size).toBe(keys.length);
    const defense = keys.find((k) => k.axis === 'defense');
    expect(defense?.value).toBe('shell');
  });

  it('says nothing about an ordinary team or a thin sample', () => {
    expect(scoutingKeys(norm, norm)).toEqual([]);
    expect(scoutingKeys({ ...norm, games: SCOUT_MIN_GAMES - 1, faceoffPct: 0.7 }, norm)).toEqual([]);
  });

  it('applies the keys on top of the current plan', () => {
    const keys = scoutingKeys({ ...norm, faceoffPct: 0.62, clearPct: 0.76 }, norm);
    const base = { ...DEFAULT_GAME_PLAN, rotation: 'tight' as const };
    expect(scoutedGamePlan(keys, base)).toEqual({ ...base, tempo: 'patient', ride: 'aggressive' });
  });
});
