import type { ScheduledGame } from '@sports-management-sim/engine-core';
import { DEFAULT_GAME_PLAN, type LacrosseGamePlan } from './game-plan';
import type { LacrosseTeamStats } from './models';

/** Per-game averages from a team's box scores this season. */
export interface TeamTendencies {
  games: number;
  goalsFor: number;
  goalsAgainst: number;
  shots: number;
  /** Goals per shot, 0–1. */
  shootingPct: number;
  /** 0–1. */
  faceoffPct: number;
  /** 0–1. */
  clearPct: number;
  turnovers: number;
  causedTurnovers: number;
  penalties: number;
}

interface Totals {
  games: number;
  goalsFor: number;
  goalsAgainst: number;
  shots: number;
  faceoffWins: number;
  faceoffAttempts: number;
  clears: number;
  clearAttempts: number;
  turnovers: number;
  causedTurnovers: number;
  penalties: number;
}

const EMPTY: Totals = {
  games: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  shots: 0,
  faceoffWins: 0,
  faceoffAttempts: 0,
  clears: 0,
  clearAttempts: 0,
  turnovers: 0,
  causedTurnovers: 0,
  penalties: 0,
};

function add(t: Totals, own: LacrosseTeamStats, opp: LacrosseTeamStats): Totals {
  return {
    games: t.games + 1,
    goalsFor: t.goalsFor + own.goals,
    goalsAgainst: t.goalsAgainst + opp.goals,
    shots: t.shots + own.shots,
    faceoffWins: t.faceoffWins + own.faceoffWins,
    faceoffAttempts: t.faceoffAttempts + own.faceoffAttempts,
    clears: t.clears + own.clears,
    clearAttempts: t.clearAttempts + own.clearAttempts,
    turnovers: t.turnovers + own.turnovers,
    causedTurnovers: t.causedTurnovers + own.causedTurnovers,
    penalties: t.penalties + own.penalties,
  };
}

function averages(t: Totals): TeamTendencies | null {
  if (t.games === 0) return null;
  const per = (n: number) => n / t.games;
  return {
    games: t.games,
    goalsFor: per(t.goalsFor),
    goalsAgainst: per(t.goalsAgainst),
    shots: per(t.shots),
    shootingPct: t.shots > 0 ? t.goalsFor / t.shots : 0,
    faceoffPct: t.faceoffAttempts > 0 ? t.faceoffWins / t.faceoffAttempts : 0.5,
    clearPct: t.clearAttempts > 0 ? t.clears / t.clearAttempts : 0,
    turnovers: per(t.turnovers),
    causedTurnovers: per(t.causedTurnovers),
    penalties: per(t.penalties),
  };
}

type BoxedGame = ScheduledGame & { result: { teamStats: { home: LacrosseTeamStats; away: LacrosseTeamStats } } };

function boxedGames(schedule: readonly ScheduledGame[]): BoxedGame[] {
  return schedule.filter((g): g is BoxedGame => {
    const stats = g.status === 'final' ? (g.result?.teamStats as { home?: unknown; away?: unknown } | undefined) : undefined;
    return stats?.home !== undefined && stats.away !== undefined;
  });
}

/** One team's per-game averages, or null before it has a box score. */
export function teamTendencies(schedule: readonly ScheduledGame[], teamId: string): TeamTendencies | null {
  let t = EMPTY;
  for (const g of boxedGames(schedule)) {
    if (g.homeTeamId === teamId) t = add(t, g.result.teamStats.home, g.result.teamStats.away);
    else if (g.awayTeamId === teamId) t = add(t, g.result.teamStats.away, g.result.teamStats.home);
  }
  return averages(t);
}

/** The league's per-team-game averages, the baseline a scout compares against. */
export function leagueTendencies(schedule: readonly ScheduledGame[]): TeamTendencies | null {
  let t = EMPTY;
  for (const g of boxedGames(schedule)) {
    t = add(t, g.result.teamStats.home, g.result.teamStats.away);
    t = add(t, g.result.teamStats.away, g.result.teamStats.home);
  }
  return averages(t);
}

export type ScoutAxis = keyof LacrosseGamePlan;

export interface ScoutKey {
  /** The game plan axis this key adjusts. */
  axis: ScoutAxis;
  /** The setting the scout recommends on that axis. */
  value: LacrosseGamePlan[ScoutAxis];
  /** What the scout saw and why it calls for the adjustment. */
  note: string;
  /** How far past the league norm the tendency is, in units of its threshold. Higher = stronger read. */
  strength: number;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const one = (n: number) => n.toFixed(1);

/** Below this many games a team's averages are noise. */
export const SCOUT_MIN_GAMES = 2;

/**
 * Up to three keys to the game, at most one per game plan axis, strongest
 * first. Each one names an opponent tendency well off the league norm and
 * the plan setting that plays against it.
 */
export function scoutingKeys(opponent: TeamTendencies, league: TeamTendencies): ScoutKey[] {
  if (opponent.games < SCOUT_MIN_GAMES) return [];
  const candidates: ScoutKey[] = [];
  const read = (gap: number, threshold: number, key: Omit<ScoutKey, 'strength'>) => {
    if (gap >= threshold) candidates.push({ ...key, strength: gap / threshold });
  };
  read(opponent.faceoffPct - league.faceoffPct, 0.05, {
    axis: 'tempo',
    value: 'patient',
    note: `They win ${pct(opponent.faceoffPct)} of faceoffs. A patient tempo keeps the ball out of their sticks.`,
  });
  read(league.clearPct - opponent.clearPct, 0.04, {
    axis: 'ride',
    value: 'aggressive',
    note: `They clear only ${pct(opponent.clearPct)} of the time. An aggressive ride can steal possessions.`,
  });
  read(opponent.goalsFor - league.goalsFor, 2, {
    axis: 'ride',
    value: 'conservative',
    note: `They score ${one(opponent.goalsFor)} a game. Get back and take away their transition.`,
  });
  read(opponent.turnovers - league.turnovers, 2, {
    axis: 'defense',
    value: 'pressure',
    note: `They turn it over ${one(opponent.turnovers)} times a game. Pressure defense forces more giveaways.`,
  });
  read(opponent.shootingPct - league.shootingPct, 0.03, {
    axis: 'defense',
    value: 'shell',
    note: `They shoot ${pct(opponent.shootingPct)}. A shell defense contests every look.`,
  });
  read(opponent.goalsAgainst - league.goalsAgainst, 2, {
    axis: 'tempo',
    value: 'uptempo',
    note: `They give up ${one(opponent.goalsAgainst)} a game. Push the pace and run with them.`,
  });
  read(opponent.penalties - league.penalties, 1, {
    axis: 'rotation',
    value: 'deep',
    note: `They take ${one(opponent.penalties)} penalties a game. Fresh legs from a deep rotation draw more of them.`,
  });

  const keys: ScoutKey[] = [];
  for (const key of candidates.sort((a, b) => b.strength - a.strength)) {
    if (keys.length === 3) break;
    if (!keys.some((k) => k.axis === key.axis)) keys.push(key);
  }
  return keys;
}

/** The scout's plan: the current plan with each key's setting applied. */
export function scoutedGamePlan(keys: readonly ScoutKey[], base: LacrosseGamePlan = DEFAULT_GAME_PLAN): LacrosseGamePlan {
  return keys.reduce<LacrosseGamePlan>((plan, key) => ({ ...plan, [key.axis]: key.value }), { ...base });
}
