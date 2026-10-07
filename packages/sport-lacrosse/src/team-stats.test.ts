import { describe, expect, it } from 'vitest';
import type { ScheduledGame } from '@sports-management-sim/engine-core';
import type { LacrosseTeamStats } from './models';
import { sortTeamStats, taleOfTheTape, teamStatHighlights, teamStatRankings } from './team-stats';

function box(goals: number, over: Partial<LacrosseTeamStats> = {}): LacrosseTeamStats {
  return {
    goals,
    shots: 30,
    shotsOnGoal: 20,
    assists: 0,
    turnovers: 12,
    causedTurnovers: 6,
    groundBalls: 25,
    faceoffWins: 10,
    faceoffAttempts: 20,
    saves: 10,
    clears: 15,
    clearAttempts: 18,
    penalties: 3,
    penaltyMinutes: 3,
    ...over,
  };
}

function game(id: string, home: string, away: string, h: LacrosseTeamStats, a: LacrosseTeamStats): ScheduledGame {
  const homeWon = h.goals > a.goals;
  return {
    id,
    seasonYear: 2028,
    week: 1,
    homeTeamId: home,
    awayTeamId: away,
    conferenceGame: false,
    status: 'final',
    result: {
      homeScore: h.goals,
      awayScore: a.goals,
      winnerTeamId: homeWon ? home : away,
      loserTeamId: homeWon ? away : home,
      overtime: false,
      teamStats: { home: h, away: a },
    },
  };
}

describe('teamStatRankings', () => {
  const schedule: ScheduledGame[] = [
    game('1', 'a', 'b', box(15, { faceoffWins: 14, turnovers: 8 }), box(5, { faceoffWins: 6 })),
    game('2', 'c', 'd', box(10), box(10, { turnovers: 20 })),
    { id: '3', seasonYear: 2028, week: 2, homeTeamId: 'a', awayTeamId: 'c', conferenceGame: false, status: 'scheduled' },
  ];

  it('ranks each stat with the right direction and leaves out teams without games', () => {
    const rows = teamStatRankings(schedule, ['a', 'b', 'c', 'd', 'e']);
    expect(rows.map((r) => r.teamId).sort()).toEqual(['a', 'b', 'c', 'd']);
    const a = rows.find((r) => r.teamId === 'a')!;
    expect(a.values.goalsFor).toBe(15);
    expect(a.values.margin).toBe(10);
    expect(a.values.faceoffPct).toBeCloseTo(0.7);
    expect(a.ranks.goalsFor).toBe(1);
    // Fewest goals allowed ranks first.
    expect(a.ranks.goalsAgainst).toBe(1);
    // Fewest turnovers ranks first; most turnovers ranks last.
    expect(a.ranks.turnovers).toBe(1);
    expect(rows.find((r) => r.teamId === 'd')!.ranks.turnovers).toBe(4);
  });

  it('gives tied teams the same rank', () => {
    const rows = teamStatRankings(schedule, ['a', 'b', 'c', 'd']);
    const c = rows.find((r) => r.teamId === 'c')!;
    const d = rows.find((r) => r.teamId === 'd')!;
    expect(c.ranks.goalsFor).toBe(2);
    expect(d.ranks.goalsFor).toBe(2);
    expect(rows.find((r) => r.teamId === 'b')!.ranks.goalsFor).toBe(4);
  });

  it('sorts best-first and names a team best and worst stat', () => {
    const rows = teamStatRankings(schedule, ['a', 'b', 'c', 'd']);
    expect(sortTeamStats(rows, 'goalsAgainst')[0]!.teamId).toBe('a');
    expect(sortTeamStats(rows, 'goalsFor').at(-1)!.teamId).toBe('b');
    const b = teamStatHighlights(rows, 'b')!;
    expect(b.worst.rank).toBe(4);
    expect(teamStatHighlights(rows, 'e')).toBeNull();
  });

  it('builds a tale of the tape once both teams have played', () => {
    const rows = teamStatRankings(schedule, ['a', 'b', 'c', 'd']);
    const tape = taleOfTheTape(rows, 'a', 'b')!;
    expect(tape).toHaveLength(8);
    const scoring = tape.find((l) => l.key === 'goalsFor')!;
    expect(scoring).toMatchObject({ user: { value: 15, rank: 1 }, opponent: { value: 5, rank: 4 }, edge: 'user' });
    // Same shooting on the same shots and clears: ranks tie, nobody has the edge.
    expect(taleOfTheTape(rows, 'c', 'd')!.find((l) => l.key === 'clearPct')!.edge).toBe('even');
    expect(taleOfTheTape(rows, 'd', 'c')!.find((l) => l.key === 'turnovers')!.edge).toBe('opponent');
    expect(taleOfTheTape(rows, 'a', 'e')).toBeNull();
  });
});
