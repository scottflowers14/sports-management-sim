import { describe, expect, it } from 'vitest';
import { createFreshLacrosseDynasty } from './dynasty-factory';
import {
  buildPlayerRows,
  buildProgramRows,
  computeGoalTotals,
  filterPlayerRows,
  sortRows,
} from './league-browser';
import type { ScheduledGame } from '@sports-management-sim/engine-core';

describe('league browser', () => {
  const dynasty = createFreshLacrosseDynasty();
  const { teams, conferences } = dynasty.season;

  it('builds one program row per team with the user team flagged', () => {
    const rows = buildProgramRows({
      teams,
      conferences,
      rankings: [],
      goalTotals: new Map(),
      userTeamId: dynasty.userTeamId,
    });
    expect(rows).toHaveLength(teams.length);
    expect(rows.filter((r) => r.isUser)).toHaveLength(1);
    expect(rows.every((r) => r.rank === null && r.overall > 0)).toBe(true);
  });

  it('builds a player row for every rostered player', () => {
    const rows = buildPlayerRows(teams, {}, dynasty.userTeamId);
    expect(rows).toHaveLength(teams.reduce((n, t) => n + t.roster.length, 0));
  });

  it('filters by position, team, and name search', () => {
    const rows = buildPlayerRows(teams, {}, dynasty.userTeamId);
    const goalies = filterPlayerRows(rows, { position: 'GK' });
    expect(goalies.length).toBeGreaterThan(0);
    expect(goalies.every((r) => r.position === 'GK')).toBe(true);

    const userOnly = filterPlayerRows(rows, { teamId: dynasty.userTeamId });
    expect(userOnly.every((r) => r.isUser)).toBe(true);

    const target = rows[0]!;
    const byName = filterPlayerRows(rows, { search: target.name.toUpperCase() });
    expect(byName.map((r) => r.playerId)).toContain(target.playerId);
  });

  it('sorts numbers and strings and sinks nulls', () => {
    const data = [
      { n: 2, s: 'b', r: null as number | null },
      { n: 3, s: 'a', r: 1 },
      { n: 1, s: 'c', r: 2 },
    ];
    expect(sortRows(data, 'n', 'desc').map((d) => d.n)).toEqual([3, 2, 1]);
    expect(sortRows(data, 's', 'asc').map((d) => d.s)).toEqual(['a', 'b', 'c']);
    expect(sortRows(data, 'r', 'asc').map((d) => d.r)).toEqual([1, 2, null]);
    expect(sortRows(data, 'r', 'desc').map((d) => d.r)).toEqual([2, 1, null]);
  });

  it('totals goals for and against from final games only', () => {
    const game = (status: ScheduledGame['status'], home: number, away: number): ScheduledGame => ({
      id: `${status}-${home}`,
      seasonYear: 2028,
      week: 1,
      homeTeamId: 'a',
      awayTeamId: 'b',
      conferenceGame: false,
      status,
      ...(status === 'final'
        ? { result: { homeScore: home, awayScore: away, winnerTeamId: 'a', loserTeamId: 'b', overtime: false } }
        : {}),
    });
    const totals = computeGoalTotals([game('final', 10, 7), game('final', 12, 11), game('scheduled', 0, 0)]);
    expect(totals.get('a')).toEqual({ for: 22, against: 18 });
    expect(totals.get('b')).toEqual({ for: 18, against: 22 });
  });
});
