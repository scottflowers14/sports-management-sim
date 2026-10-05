import { describe, expect, it } from 'vitest';
import { generateLacrosseRoster } from '@sports-management-sim/sport-lacrosse';
import { careerMilestonesForWeek } from './career-milestones';
import type { CareerStatsMap } from './career-stats';
import type { PlayerSeasonStats } from './stats';

const roster = generateLacrosseRoster({ seed: 3, prestige: 60, createdSeason: 2028 }).slice(0, 2);
const [a, b] = [roster[0]!, roster[1]!];

function line(playerId: string, over: Partial<PlayerSeasonStats>): PlayerSeasonStats {
  return {
    playerId, gamesPlayed: 1, goals: 0, assists: 0, shots: 0, groundBalls: 0, turnovers: 0,
    causedTurnovers: 0, faceoffWins: 0, faceoffAttempts: 0, saves: 0, goalsAllowed: 0, ...over,
  };
}

const careers: CareerStatsMap = {
  [a.id]: {
    playerId: a.id,
    name: 'A',
    position: a.position,
    seasons: [{ year: 2027, teamName: 't', classYear: 'SO', position: a.position, stats: line(a.id, { gamesPlayed: 15, goals: 45, assists: 50 }) }],
  },
};

describe('careerMilestonesForWeek', () => {
  it('reports a career mark crossed this week, counting past seasons', () => {
    const before = { [a.id]: line(a.id, { goals: 3, assists: 1 }) };
    const after = { [a.id]: line(a.id, { goals: 6, assists: 1 }) };
    // 45+50+3+1 = 99 points before, 102 after; 48 goals before, 51 after.
    expect(careerMilestonesForWeek([a, b], careers, before, after)).toEqual([
      { playerId: a.id, label: 'career points', mark: 100 },
      { playerId: a.id, label: 'career goals', mark: 50 },
    ]);
  });

  it('reports only the highest mark per stat and ignores players who did not play', () => {
    const after = { [b.id]: line(b.id, { saves: 520 }) };
    expect(careerMilestonesForWeek([a, b], {}, {}, after)).toEqual([{ playerId: b.id, label: 'career saves', mark: 500 }]);
    expect(careerMilestonesForWeek([a, b], careers, {}, {})).toEqual([]);
  });
});
