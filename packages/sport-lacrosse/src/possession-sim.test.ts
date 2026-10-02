import { describe, expect, it } from 'vitest';
import { simulateLacrosseGameWithLog } from './game-log';
import type { LacrossePlayerGameStats } from './models';
import { generateLacrosseRoster } from './roster-generation';
import { simulatePossessionGame, OVERTIME_SECONDS, PERIOD_SECONDS } from './possession-sim';
import { makeLacrosseTeam, repeatingRandom } from './test-fixtures';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const home = makeLacrosseTeam('home', generateLacrosseRoster({ seed: 7, prestige: 62, createdSeason: 2028 }));
const away = makeLacrosseTeam('away', generateLacrosseRoster({ seed: 8, prestige: 58, createdSeason: 2028 }));

function sum(lines: LacrossePlayerGameStats[], key: keyof LacrossePlayerGameStats): number {
  return lines.reduce((s, l) => s + ((l[key] as number | undefined) ?? 0), 0);
}

describe('simulatePossessionGame', () => {
  const game = simulatePossessionGame({ homeTeam: home, awayTeam: away, random: seededRandom(3) });
  const { result, players, log } = game;
  const stats = result.teamStats!;

  it('builds every team total from the individual lines', () => {
    for (const [side, lines] of [
      ['home', players.home],
      ['away', players.away],
    ] as const) {
      const team = stats[side];
      expect(sum(lines, 'goals')).toBe(team.goals);
      expect(sum(lines, 'assists')).toBe(team.assists);
      expect(sum(lines, 'shots')).toBe(team.shots);
      expect(sum(lines, 'shotsOnGoal')).toBe(team.shotsOnGoal);
      expect(sum(lines, 'groundBalls')).toBe(team.groundBalls);
      expect(sum(lines, 'turnovers')).toBe(team.turnovers);
      expect(sum(lines, 'causedTurnovers')).toBe(team.causedTurnovers);
      expect(sum(lines, 'faceoffWins')).toBe(team.faceoffWins);
      expect(sum(lines, 'faceoffAttempts')).toBe(team.faceoffAttempts);
      expect(sum(lines, 'saves')).toBe(team.saves);
      expect(sum(lines, 'penalties')).toBe(team.penalties);
    }
    expect(stats.home.goals).toBe(result.homeScore);
    expect(stats.away.goals).toBe(result.awayScore);
  });

  it('keeps the two box scores consistent with each other', () => {
    // Every shot on goal is a goal or a save, both teams take the same draws,
    // and the goalie who faced the shots owns every goal allowed.
    expect(stats.home.saves).toBe(stats.away.shotsOnGoal - stats.away.goals);
    expect(stats.away.saves).toBe(stats.home.shotsOnGoal - stats.home.goals);
    expect(stats.home.faceoffAttempts).toBe(stats.away.faceoffAttempts);
    expect(stats.home.faceoffWins + stats.away.faceoffWins).toBe(stats.home.faceoffAttempts);
    expect(sum(players.away, 'goalsAllowed')).toBe(result.homeScore);
    expect(sum(players.home, 'goalsAllowed')).toBe(result.awayScore);
    expect(stats.home.clears).toBeLessThanOrEqual(stats.home.clearAttempts);
    for (const line of [...players.home, ...players.away]) {
      expect(line.goals).toBeLessThanOrEqual(line.shotsOnGoal);
      expect(line.shotsOnGoal).toBeLessThanOrEqual(line.shots);
    }
  });

  it('only gives lines to players on the roster who actually took the field', () => {
    const homeIds = new Set(home.roster.map((p) => p.id));
    const awayIds = new Set(away.roster.map((p) => p.id));
    for (const line of players.home) expect(homeIds.has(line.playerId)).toBe(true);
    for (const line of players.away) expect(awayIds.has(line.playerId)).toBe(true);
    // Deep reserves never dress for a single game.
    expect(players.home.length).toBeGreaterThan(15);
    expect(players.home.length).toBeLessThan(home.roster.length);
    // Only goalies make saves, only faceoff men take draws.
    const homeById = new Map(home.roster.map((p) => [p.id, p]));
    for (const line of players.home) {
      if ((line.saves ?? 0) > 0) expect(homeById.get(line.playerId)!.position).toBe('GK');
      if ((line.faceoffAttempts ?? 0) > 0) expect(['FOGO', 'MID']).toContain(homeById.get(line.playerId)!.position);
    }
  });

  it('narrates the game possession by possession with a running score', () => {
    const goals = log.events.filter((e) => e.type === 'goal');
    expect(goals.length).toBe(result.homeScore + result.awayScore);
    const types = new Set(log.events.map((e) => e.type));
    for (const type of ['faceoff', 'shot', 'save', 'goal', 'turnover', 'period_end']) expect(types.has(type as never)).toBe(true);
    expect(log.events.filter((e) => e.type === 'period_end').length).toBe(result.overtime ? 5 : 4);
    // The running score climbs one goal at a time and lands on the final.
    let homeRunning = 0;
    let awayRunning = 0;
    for (const e of log.events) {
      if (e.type === 'goal') {
        if (e.teamId === home.id) homeRunning += 1;
        else awayRunning += 1;
      }
      expect(e.homeScore).toBe(homeRunning);
      expect(e.awayScore).toBe(awayRunning);
      expect(e.timeElapsed).toBeGreaterThanOrEqual(0);
      expect(e.timeElapsed).toBeLessThanOrEqual(e.period === 'OT' ? OVERTIME_SECONDS : PERIOD_SECONDS);
    }
    expect(homeRunning).toBe(result.homeScore);
    // Goals in the log are the goals in the box score, scorer by scorer.
    const scorerCounts = new Map<string, number>();
    for (const g of goals) scorerCounts.set(g.playerId!, (scorerCounts.get(g.playerId!) ?? 0) + 1);
    for (const line of [...players.home, ...players.away]) expect(scorerCounts.get(line.playerId) ?? 0).toBe(line.goals);
  });

  it('reports possessions and man-up chances for both sides', () => {
    expect(log.possessions!.home).toBeGreaterThan(20);
    expect(log.possessions!.away).toBeGreaterThan(20);
    expect(log.extraMan!.home.goals).toBeLessThanOrEqual(log.extraMan!.home.chances);
    expect(log.playerLines!.length).toBe(players.home.length + players.away.length);
  });

  it('is deterministic for the same random source', () => {
    const a = simulatePossessionGame({ homeTeam: home, awayTeam: away, random: seededRandom(21) });
    const b = simulatePossessionGame({ homeTeam: home, awayTeam: away, random: seededRandom(21) });
    expect(b).toEqual(a);
  });

  it('settles ties in sudden-victory overtime with exactly one overtime goal', () => {
    let found = 0;
    for (let seed = 0; seed < 400 && found < 5; seed += 1) {
      const g = simulateLacrosseGameWithLog({ homeTeam: home, awayTeam: away, random: seededRandom(seed) });
      if (!g.overtime) continue;
      found += 1;
      expect(Math.abs(g.homeScore - g.awayScore)).toBe(1);
      const otGoals = g.log.events.filter((e) => e.type === 'goal' && e.period === 'OT');
      expect(otGoals.length).toBe(1);
      expect(otGoals[0]!.isKeyPlay).toBe(true);
    }
    expect(found).toBeGreaterThan(0);
  });

  it('never ends tied, even when the random source never lets anyone score', () => {
    const g = simulatePossessionGame({ homeTeam: home, awayTeam: away, random: repeatingRandom(0.999) });
    expect(g.result.homeScore).not.toBe(g.result.awayScore);
    expect(g.result.teamStats!.home.goals).toBe(g.result.homeScore);
    expect(g.result.teamStats!.away.goals).toBe(g.result.awayScore);
  });

  it('survives rosters missing whole positions', () => {
    const thin = makeLacrosseTeam('thin');
    const g = simulatePossessionGame({ homeTeam: thin, awayTeam: away, random: seededRandom(9) });
    expect(g.result.homeScore + g.result.awayScore).toBeGreaterThan(0);
    expect(g.result.teamStats!.home.faceoffAttempts).toBe(g.result.teamStats!.away.faceoffAttempts);
  });
});

describe('tactics inside the possession engine', () => {
  function averageOver(games: number, build: (random: () => number) => ReturnType<typeof simulatePossessionGame>) {
    const random = seededRandom(77);
    const totals = { homeGoals: 0, awayGoals: 0, homeFastBreakGoals: 0, awayPossessions: 0, homeWins: 0, manUpGoals: 0, firstLineShots: 0, thirdLineShots: 0 };
    for (let i = 0; i < games; i += 1) {
      const g = build(random);
      totals.homeGoals += g.result.homeScore;
      totals.awayGoals += g.result.awayScore;
      totals.awayPossessions += g.log.possessions!.away;
      totals.homeWins += g.result.winnerTeamId === g.log.homeTeamId ? 1 : 0;
      totals.manUpGoals += g.log.extraMan!.home.goals;
      totals.homeFastBreakGoals += g.log.events.filter((e) => e.type === 'goal' && e.teamId === g.log.homeTeamId && e.description.includes('fast break')).length;
    }
    return Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v / games])) as typeof totals;
  }

  it('a conservative ride concedes almost no fast breaks; an aggressive one gives them up', () => {
    const aggressive = averageOver(200, (random) =>
      simulatePossessionGame({ homeTeam: home, awayTeam: away, random, awayGamePlan: { ride: 'aggressive' } }),
    );
    const conservative = averageOver(200, (random) =>
      simulatePossessionGame({ homeTeam: home, awayTeam: away, random, awayGamePlan: { ride: 'conservative' } }),
    );
    expect(aggressive.homeFastBreakGoals).toBeGreaterThan(conservative.homeFastBreakGoals * 2);
  });

  it('the trailing team pushes pace late and the leading team kills clock', () => {
    // Over many games, possessions in the last four minutes are shorter for the
    // team chasing and longer for the team protecting.
    const random = seededRandom(5);
    let chasing = { seconds: 0, n: 0 };
    let protecting = { seconds: 0, n: 0 };
    for (let i = 0; i < 300; i += 1) {
      const g = simulatePossessionGame({ homeTeam: home, awayTeam: away, random });
      const q4 = g.log.events.filter((e) => e.period === 4 && e.timeElapsed >= PERIOD_SECONDS - 240);
      let start: number | null = null;
      let startTeam: string | null = null;
      let startLead = 0;
      for (const e of q4) {
        if (e.type === 'faceoff') {
          start = e.timeElapsed;
          startTeam = e.teamId;
          startLead = (e.teamId === g.log.homeTeamId ? 1 : -1) * (e.homeScore - e.awayScore);
          continue;
        }
        if (start === null || startTeam === null) continue;
        if (['goal', 'turnover', 'save', 'shot'].includes(e.type) && e.teamId === startTeam) {
          const bucket = startLead <= -2 ? chasing : startLead >= 2 ? protecting : null;
          if (bucket) {
            bucket.seconds += e.timeElapsed - start;
            bucket.n += 1;
          }
          start = null;
        }
      }
    }
    chasing = { ...chasing };
    protecting = { ...protecting };
    expect(chasing.n).toBeGreaterThan(30);
    expect(protecting.n).toBeGreaterThan(30);
    expect(protecting.seconds / protecting.n).toBeGreaterThan((chasing.seconds / chasing.n) * 1.5);
  });

  it('a tight rotation spreads shots across fewer midfielders than a deep one', () => {
    const shotsByLine = (rotation: 'tight' | 'deep') => {
      const random = seededRandom(13);
      const mids = home.roster.filter((p) => p.position === 'MID').sort((a, b) => b.ratings.overall - a.ratings.overall);
      const third = new Set(mids.slice(6, 9).map((p) => p.id));
      let thirdLine = 0;
      let total = 0;
      for (let i = 0; i < 120; i += 1) {
        const g = simulatePossessionGame({ homeTeam: home, awayTeam: away, random, homeGamePlan: { rotation } });
        for (const l of g.players.home) {
          if (third.has(l.playerId)) thirdLine += l.shots;
          total += l.shots;
        }
      }
      return thirdLine / total;
    };
    expect(shotsByLine('deep')).toBeGreaterThan(shotsByLine('tight') * 2);
  });

  it('man-up chances convert far more often than settled possessions', () => {
    const random = seededRandom(41);
    let manUp = { goals: 0, chances: 0 };
    let all = { goals: 0, possessions: 0 };
    for (let i = 0; i < 300; i += 1) {
      const g = simulatePossessionGame({ homeTeam: home, awayTeam: away, random });
      manUp = { goals: manUp.goals + g.log.extraMan!.home.goals + g.log.extraMan!.away.goals, chances: manUp.chances + g.log.extraMan!.home.chances + g.log.extraMan!.away.chances };
      all = { goals: all.goals + g.result.homeScore + g.result.awayScore, possessions: all.possessions + g.log.possessions!.home + g.log.possessions!.away };
    }
    expect(manUp.chances).toBeGreaterThan(200);
    expect(manUp.goals / manUp.chances).toBeGreaterThan((all.goals / all.possessions) * 1.2);
    expect(manUp.goals / manUp.chances).toBeLessThan(0.6);
  });
});
