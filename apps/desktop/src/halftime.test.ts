import { describe, expect, it } from 'vitest';
import type { GameEvent, GameLog } from '@sports-management-sim/sport-lacrosse';
import { halftimeAdvice, halftimeReport } from './halftime';

let n = 0;
function ev(period: GameEvent['period'], type: GameEvent['type'], teamId: string, homeScore = 0, awayScore = 0): GameEvent {
  return { id: String(n++), period, timeElapsed: 0, type, teamId, homeScore, awayScore, description: '', isKeyPlay: false };
}

function log(events: GameEvent[]): GameLog {
  return { homeTeamId: 'us', awayTeamId: 'them', events, leadChanges: 0, biggestLead: 0 };
}

describe('halftime', () => {
  it('counts only the first half', () => {
    const report = halftimeReport(
      log([
        ev(1, 'faceoff', 'them'),
        ev(1, 'goal', 'them', 0, 1),
        ev(1, 'save', 'us', 0, 1),
        ev(2, 'turnover', 'us', 0, 1),
        ev(2, 'goal', 'us', 1, 1),
        ev(2, 'period_end', 'us', 1, 1),
        ev(3, 'goal', 'us', 2, 1),
      ]),
    );
    expect(report.homeScore).toBe(1);
    expect(report.awayScore).toBe(1);
    expect(report.home).toEqual({ goals: 1, shots: 2, faceoffWins: 0, turnovers: 1, penalties: 0 });
    expect(report.away).toEqual({ goals: 1, shots: 1, faceoffWins: 1, turnovers: 0, penalties: 0 });
    expect(report.goals).toHaveLength(2);
  });

  it('tells a trailing team to push and a leading team to protect', () => {
    const trailing = halftimeReport(log([ev(2, 'period_end', 'us', 3, 7)]));
    expect(halftimeAdvice(trailing, 'us')[0]!.plan).toEqual({ tempo: 'uptempo', defense: 'pressure', ride: 'aggressive' });
    // The same score reads the other way for the away side.
    expect(halftimeAdvice(trailing, 'them')[0]!.plan).toEqual({ tempo: 'patient', defense: 'shell', ride: 'conservative' });
  });

  it('only blames the pressure defense for penalties when it is the plan', () => {
    const report = halftimeReport(log([ev(1, 'penalty', 'us'), ev(1, 'penalty', 'us'), ev(2, 'penalty', 'us'), ev(2, 'period_end', 'us', 4, 4)]));
    const pressure = { tempo: 'balanced', defense: 'pressure', ride: 'standard', rotation: 'balanced' } as const;
    expect(halftimeAdvice(report, 'us', pressure).map((t) => t.plan)).toContainEqual({ defense: 'balanced' });
    expect(halftimeAdvice(report, 'us', { ...pressure, defense: 'shell' }).map((t) => t.plan)).not.toContainEqual({ defense: 'balanced' });
  });

  it('flags a faceoff beating and stays the course in a close game', () => {
    const faceoffs = [...Array(7)].map(() => ev(1, 'faceoff', 'them'));
    const report = halftimeReport(log([...faceoffs, ev(1, 'faceoff', 'us'), ev(2, 'period_end', 'us', 4, 4)]));
    expect(halftimeAdvice(report, 'us').map((t) => t.text).join(' ')).toMatch(/won 7 of 8 faceoffs/);
    const close = halftimeReport(log([ev(2, 'period_end', 'us', 5, 4)]));
    expect(halftimeAdvice(close, 'us')).toEqual([{ text: 'Close game and the plan is working. Stay the course.', plan: {} }]);
  });
});
