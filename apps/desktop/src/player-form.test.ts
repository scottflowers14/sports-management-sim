import { describe, expect, it } from 'vitest';
import type { LacrossePlayerGameStats } from '@sports-management-sim/sport-lacrosse';
import { FORM_MIN_BASELINE, FORM_WINDOW, playerFormFromLog, rosterForm } from './player-form';
import type { PlayerGameRow } from './player-game-log';
import { createFreshLacrosseDynasty } from './dynasty-factory';
import { createScoutingState } from './scouting';
import { emptyRecruitingActivity } from './recruiting-activity';
import { emptySeasonStats } from './stats';
import { simulateOneWeek, type WeekSimState } from './week-sim';

function line(over: Partial<LacrossePlayerGameStats> = {}): LacrossePlayerGameStats {
  return {
    playerId: 'p',
    teamId: 't',
    goals: 0,
    assists: 0,
    shots: 0,
    shotsOnGoal: 0,
    groundBalls: 0,
    turnovers: 0,
    causedTurnovers: 0,
    penalties: 0,
    penaltyMinutes: 0,
    ...over,
  };
}

const rows = (lines: LacrossePlayerGameStats[]): PlayerGameRow[] =>
  lines.map((l, i) => ({ gameId: `g${i}`, week: i + 1, opponentId: 'o', home: true, won: true, score: '10-8', overtime: false, line: l }));

describe('player form', () => {
  it('flags an attackman whose last three games far outrun his earlier ones', () => {
    const form = playerFormFromLog(
      rows([line({ goals: 1 }), line({ goals: 1, assists: 1 }), line({ goals: 3, assists: 2 }), line({ goals: 4 }), line({ goals: 2, assists: 3 })]),
      'ATT',
    );
    expect(form?.trend).toBe('hot');
    expect(form?.line).toBe('9G 5A in his last 3');
    expect(form!.recent).toBeGreaterThan(form!.baseline);
  });

  it('flags a slump, with position-specific lines', () => {
    const goalie = playerFormFromLog(
      rows([line({ saves: 16, goalsAllowed: 6 }), line({ saves: 15, goalsAllowed: 7 }), line({ saves: 6, goalsAllowed: 14 }), line({ saves: 5, goalsAllowed: 12 }), line({ saves: 7, goalsAllowed: 13 })]),
      'GK',
    );
    expect(goalie?.trend).toBe('cold');
    expect(goalie?.line).toBe('32% saves in his last 3');
    const fogo = playerFormFromLog(
      rows([1, 2, 3, 4, 5].map((i) => line({ faceoffWins: i < 3 ? 18 : 5, faceoffAttempts: 24 }))),
      'FOGO',
    );
    expect(fogo?.trend).toBe('cold');
    expect(fogo?.line).toBe('15/72 faceoffs in his last 3');
  });

  it('needs enough games, a real gap, and a meaningful role', () => {
    const steady = rows([1, 2, 3, 4, 5, 6].map(() => line({ goals: 2, assists: 1 })));
    expect(playerFormFromLog(steady, 'ATT')).toBeNull();
    const short = rows([line(), line(), line({ goals: 4 }), line({ goals: 4 })]);
    expect(short.length).toBeLessThan(FORM_WINDOW + FORM_MIN_BASELINE);
    expect(playerFormFromLog(short, 'ATT')).toBeNull();
    // A depth player going from nothing to one ground ball is not a heater.
    const depth = rows([line(), line(), line({ groundBalls: 2 }), line({ groundBalls: 3 }), line({ groundBalls: 2 })]);
    expect(playerFormFromLog(depth, 'DEF')).toBeNull();
  });

  it('only lists players who are hot or cold, from real game logs', () => {
    let state: WeekSimState = {
      dynasty: createFreshLacrosseDynasty(),
      rankings: [],
      injuries: [],
      newsItems: [],
      scouting: createScoutingState(),
      recruitingActivity: emptyRecruitingActivity(),
      recruitTrends: {},
      seasonStats: emptySeasonStats(),
      gameLogs: new Map(),
      bestNatRank: null,
      lastSimWeek: null,
    };
    const random = (() => {
      let s = 7;
      return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000);
    })();
    for (let w = 0; w < 7; w += 1) state = simulateOneWeek(state, undefined, random);
    const { season, userTeamId } = state.dynasty;
    const team = season.teams.find((t) => t.id === userTeamId)!;
    const form = rosterForm(team.roster, season.schedule, state.gameLogs);
    expect(form.size).toBeLessThan(team.roster.length / 3);
    for (const [id, f] of form) {
      expect(team.roster.some((p) => p.id === id)).toBe(true);
      expect(f.line).toMatch(/in his last 3$/);
    }
  });
});
