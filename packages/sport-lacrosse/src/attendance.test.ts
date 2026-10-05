import { describe, expect, it } from 'vitest';
import type { ScheduledGame } from '@sports-management-sim/engine-core';
import type { LacrosseTeam } from './models';
import {
  GATE_BONUS_CAP,
  GATE_FANS_PER_POINT,
  SELLOUT_FAN_GAIN_CAP,
  attendanceDemand,
  attendanceOf,
  formatAttendance,
  gateReceipts,
  gameAttendance,
  isSellout,
  seasonAttendance,
  selloutFanGain,
  stadiumCapacity,
} from './attendance';

/** Only the fields attendance reads. */
function team(fanSupport: number, facilities: number, wins = 0, losses = 0, nationalPrestige = 50): LacrosseTeam {
  return {
    reputation: { nationalPrestige, facilities, fanSupport },
    record: { wins, losses, conferenceWins: 0, conferenceLosses: 0 },
  } as unknown as LacrosseTeam;
}

function played(id: string, homeTeamId: string, attendance?: { count: number; capacity: number }): ScheduledGame {
  return {
    id,
    seasonYear: 2026,
    week: 1,
    homeTeamId,
    awayTeamId: 'x',
    conferenceGame: false,
    status: 'final',
    result: {
      homeScore: 10,
      awayScore: 8,
      winnerTeamId: homeTeamId,
      loserTeamId: 'x',
      overtime: false,
      ...(attendance ? { attendance } : {}),
    },
  } as ScheduledGame;
}

describe('stadium and demand', () => {
  it('sizes the stadium from facilities', () => {
    expect(stadiumCapacity(team(50, 0))).toBe(1000);
    expect(stadiumCapacity(team(50, 80))).toBe(6600);
  });

  it('draws bigger crowds for fans, winning, big visitors and rivals', () => {
    const g = { id: 'g1' };
    const base = attendanceDemand(g, team(50, 60), team(50, 60));
    expect(attendanceDemand(g, team(80, 60), team(50, 60))).toBeCloseTo(base + 0.15);
    expect(attendanceDemand(g, team(50, 60, 8, 2), team(50, 60))).toBeCloseTo(base + 0.09);
    expect(attendanceDemand(g, team(50, 60), team(50, 60, 0, 0, 90))).toBeCloseTo(base + 0.08);
    expect(attendanceDemand(g, team(50, 60), team(50, 60), { visitorRank: 4 })).toBeCloseTo(base + 0.12);
    expect(attendanceDemand(g, team(50, 60), team(50, 60), { visitorRank: 15 })).toBeCloseTo(base + 0.06);
    expect(attendanceDemand(g, team(50, 60), team(50, 60), { visitorRank: 30 })).toBeCloseTo(base);
    expect(attendanceDemand(g, team(50, 60), team(50, 60), { rivalry: true })).toBeCloseTo(base + 0.15);
  });

  it('is the same crowd on replay and varies a little by game', () => {
    const home = team(50, 60);
    const visitor = team(50, 60);
    expect(gameAttendance({ id: 'a' }, home, visitor)).toEqual(gameAttendance({ id: 'a' }, home, visitor));
    const shares = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => attendanceDemand({ id }, home, visitor));
    expect(new Set(shares).size).toBeGreaterThan(1);
    for (const s of shares) expect(Math.abs(s - 0.7)).toBeLessThanOrEqual(0.05);
  });

  it('caps at capacity, floors at 15%, and rounds to ten', () => {
    const packed = gameAttendance({ id: 'g' }, team(99, 80, 10, 0), team(50, 60, 0, 0, 90), { rivalry: true, visitorRank: 1 });
    expect(packed).toEqual({ count: 6600, capacity: 6600 });
    expect(isSellout(packed)).toBe(true);
    const empty = gameAttendance({ id: 'g' }, team(0, 80, 0, 10), team(50, 60, 0, 0, 0));
    expect(empty.count).toBeGreaterThanOrEqual(0.15 * 6600 - 10);
    expect(empty.count % 10).toBe(0);
    expect(isSellout(empty)).toBe(false);
  });
});

describe('season crowds', () => {
  it('averages home gates and counts sellouts', () => {
    const schedule = [
      played('1', 'h', { count: 5000, capacity: 5000 }),
      played('2', 'h', { count: 4000, capacity: 5000 }),
      played('3', 'h', { count: 5000, capacity: 5000 }),
      played('4', 'h'),
      played('5', 'other', { count: 900, capacity: 900 }),
    ];
    expect(attendanceOf(schedule[0]!)).toEqual({ count: 5000, capacity: 5000 });
    expect(attendanceOf(schedule[3]!)).toBeUndefined();
    expect(seasonAttendance(schedule, 'h')).toEqual({ homeGames: 3, total: 14000, average: 4667, sellouts: 2, capacity: 5000 });
    expect(seasonAttendance(schedule, 'nobody')).toBeNull();
  });

  it('gives a point of fans per two sellouts, capped', () => {
    expect(selloutFanGain(0)).toBe(0);
    expect(selloutFanGain(1)).toBe(0);
    expect(selloutFanGain(5)).toBe(2);
    expect(selloutFanGain(20)).toBe(SELLOUT_FAN_GAIN_CAP);
  });

  it('formats a gate', () => {
    expect(formatAttendance({ count: 7160, capacity: 7160 })).toBe('7,160 (sellout)');
    expect(formatAttendance({ count: 5240, capacity: 6600 })).toBe('5,240 of 6,600');
  });
});

describe('gate receipts', () => {
  it('earns a budget point per 12,000 fans, capped', () => {
    expect(gateReceipts(null)).toEqual({ totalFans: 0, homeGames: 0, sellouts: 0, bonus: 0 });
    expect(gateReceipts({ homeGames: 6, total: 11400, average: 1900, sellouts: 0, capacity: 4000 }).bonus).toBe(0);
    const mid = gateReceipts({ homeGames: 6, total: 24000, average: 4000, sellouts: 1, capacity: 5000 });
    expect(mid).toEqual({ totalFans: 24000, homeGames: 6, sellouts: 1, bonus: 24000 / GATE_FANS_PER_POINT });
    expect(gateReceipts({ homeGames: 9, total: 63000, average: 7000, sellouts: 5, capacity: 7000 }).bonus).toBe(GATE_BONUS_CAP);
  });
});
