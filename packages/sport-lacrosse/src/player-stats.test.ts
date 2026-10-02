import { describe, expect, it } from 'vitest';
import { getLacrosseStarters } from './depth-chart';
import { simulateLacrosseGameDetailed } from './simulate-game';
import { simulateLacrosseGameWithLog } from './game-log';
import { makeLacrosseTeam } from './test-fixtures';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const sum = (xs: number[]) => xs.reduce((s, n) => s + n, 0);

describe('player stat attribution', () => {
  const home = makeLacrosseTeam('home');
  const away = makeLacrosseTeam('away');

  it('preserves every team total in the individual lines', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const { result, players } = simulateLacrosseGameDetailed({ homeTeam: home, awayTeam: away, random: seededRandom(seed) });
      const stats = result.teamStats!;
      for (const [lines, team] of [[players.home, stats.home], [players.away, stats.away]] as const) {
        expect(sum(lines.map((l) => l.goals))).toBe(team.goals);
        expect(sum(lines.map((l) => l.assists))).toBe(Math.min(team.assists, team.goals));
        expect(sum(lines.map((l) => l.shots))).toBe(team.shots);
        expect(sum(lines.map((l) => l.shotsOnGoal))).toBe(team.shotsOnGoal);
        expect(sum(lines.map((l) => l.penalties))).toBe(team.penalties);
        expect(sum(lines.map((l) => l.penaltyMinutes))).toBeCloseTo(team.penaltyMinutes, 5);
        expect(sum(lines.map((l) => l.saves ?? 0))).toBe(team.saves);
        expect(sum(lines.map((l) => l.faceoffWins ?? 0))).toBe(team.faceoffWins);
        expect(sum(lines.map((l) => l.groundBalls))).toBe(team.groundBalls);
        expect(sum(lines.map((l) => l.causedTurnovers))).toBe(team.causedTurnovers);
        for (const l of lines) {
          expect(l.shots).toBeGreaterThanOrEqual(l.shotsOnGoal);
          expect(l.shotsOnGoal).toBeGreaterThanOrEqual(l.goals);
          if (l.penalties === 0) expect(l.penaltyMinutes).toBe(0);
        }
      }
    }
  });

  it('keeps the box score internally consistent between the two teams', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const { result } = simulateLacrosseGameDetailed({ homeTeam: home, awayTeam: away, random: seededRandom(seed) });
      const { home: h, away: a } = result.teamStats!;
      expect(h.faceoffAttempts).toBe(a.faceoffAttempts);
      expect(h.faceoffWins + a.faceoffWins).toBe(h.faceoffAttempts);
      expect(h.saves).toBe(a.shotsOnGoal - a.goals);
      expect(a.saves).toBe(h.shotsOnGoal - h.goals);
    }
  });

  it('gives every save to the starting goalie and nobody outside the playing group a line', () => {
    const { players } = simulateLacrosseGameDetailed({ homeTeam: home, awayTeam: away, random: seededRandom(3) });
    const starterGk = getLacrosseStarters(home, 'GK')[0]!;
    const goalieLines = players.home.filter((l) => home.roster.find((p) => p.id === l.playerId)?.position === 'GK');
    expect(goalieLines.map((l) => l.playerId)).toEqual([starterGk.id]);
    expect(players.home.length).toBeLessThan(home.roster.length);
  });

  it('narrates the same scorers in the play-by-play as in the stat lines', () => {
    const game = simulateLacrosseGameWithLog({ homeTeam: home, awayTeam: away, random: seededRandom(9) });
    const goalsByPlayer = new Map<string, number>();
    for (const e of game.log.events) {
      if (e.type !== 'goal' || !e.playerId) continue;
      const key = `${e.teamId}:${e.playerId}`;
      goalsByPlayer.set(key, (goalsByPlayer.get(key) ?? 0) + 1);
    }
    for (const line of [...game.players.home, ...game.players.away]) {
      expect(goalsByPlayer.get(`${line.teamId}:${line.playerId}`) ?? 0).toBe(line.goals);
    }
  });
});

describe('depth chart integrity', () => {
  it('ignores a saved chart that lists a player under a position he does not play', () => {
    const team = makeLacrosseTeam('home');
    const midfielder = team.roster.find((p) => p.position === 'MID')!;
    const stale = { ...team, depthChart: { ATT: [midfielder.id] } };
    expect(getLacrosseStarters(stale, 'ATT').map((p) => p.id)).not.toContain(midfielder.id);
    const { players } = simulateLacrosseGameDetailed({ homeTeam: stale, awayTeam: makeLacrosseTeam('away'), random: seededRandom(4) });
    expect(players.home.filter((l) => l.playerId === midfielder.id).length).toBeLessThanOrEqual(1);
  });
});
