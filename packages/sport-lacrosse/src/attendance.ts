import type { ScheduledGame } from '@sports-management-sim/engine-core';
import type { LacrosseTeam } from './models';

/**
 * Game-day crowds, OOTP style: the home stadium's size comes from its
 * facilities, and how full it gets from fan support, how the home team is
 * playing, and how big the visitor is.
 */
export interface GameAttendance {
  count: number;
  capacity: number;
}

export interface AttendanceContext {
  /** The visitor's national rank before the game, if ranked. */
  visitorRank?: number | null;
  rivalry?: boolean;
}

/** Seats in a program's home stadium. */
export function stadiumCapacity(team: Pick<LacrosseTeam, 'reputation'>): number {
  return 1000 + Math.round(team.reputation.facilities) * 70;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Share of seats the game would fill; 1 or more is a sellout. A little
 * game-to-game noise comes from the game id, so a replay draws the same crowd.
 */
export function attendanceDemand(
  game: Pick<ScheduledGame, 'id'>,
  home: Pick<LacrosseTeam, 'reputation' | 'record'>,
  visitor: Pick<LacrosseTeam, 'reputation'>,
  context: AttendanceContext = {},
): number {
  const played = home.record.wins + home.record.losses;
  const winPct = played > 0 ? home.record.wins / played : 0.5;
  const rank = context.visitorRank ?? null;
  const visitorDraw = rank !== null && rank <= 10 ? 0.12 : rank !== null && rank <= 20 ? 0.06 : 0;
  const noise = ((hash(game.id) % 1000) / 1000 - 0.5) * 0.1;
  return (
    0.45 +
    home.reputation.fanSupport / 200 +
    (winPct - 0.5) * 0.3 +
    (visitor.reputation.nationalPrestige - 50) / 500 +
    visitorDraw +
    (context.rivalry ? 0.15 : 0) +
    noise
  );
}

/** The crowd for a home game, rounded to the nearest ten. */
export function gameAttendance(
  game: Pick<ScheduledGame, 'id'>,
  home: Pick<LacrosseTeam, 'reputation' | 'record'>,
  visitor: Pick<LacrosseTeam, 'reputation'>,
  context: AttendanceContext = {},
): GameAttendance {
  const capacity = stadiumCapacity(home);
  const share = Math.max(0.15, Math.min(1, attendanceDemand(game, home, visitor, context)));
  return { count: Math.min(capacity, Math.round((share * capacity) / 10) * 10), capacity };
}

export function isSellout(attendance: GameAttendance): boolean {
  return attendance.count >= attendance.capacity;
}

/** Read the crowd stamped on a played game, if any. */
export function attendanceOf(game: ScheduledGame): GameAttendance | undefined {
  return (game.result as { attendance?: GameAttendance } | undefined)?.attendance;
}

export interface SeasonAttendance {
  homeGames: number;
  /** Fans through the gates over the season. */
  total: number;
  average: number;
  sellouts: number;
  capacity: number;
}

/** A program's home crowds this season; null before its first home game with a gate. */
export function seasonAttendance(schedule: readonly ScheduledGame[], teamId: string): SeasonAttendance | null {
  const gates = schedule
    .filter((g) => g.homeTeamId === teamId && g.status === 'final')
    .map(attendanceOf)
    .filter((a): a is GameAttendance => a !== undefined);
  if (gates.length === 0) return null;
  const total = gates.reduce((sum, a) => sum + a.count, 0);
  return {
    homeGames: gates.length,
    total,
    average: Math.round(total / gates.length),
    sellouts: gates.filter(isSellout).length,
    capacity: gates[gates.length - 1]!.capacity,
  };
}

/** Packed houses build the fan base: a point of fan support per two sellouts, up to three. */
export const SELLOUT_FAN_GAIN_CAP = 3;

export function selloutFanGain(sellouts: number): number {
  return Math.min(SELLOUT_FAN_GAIN_CAP, Math.floor(sellouts / 2));
}

export function formatAttendance(attendance: GameAttendance): string {
  return `${attendance.count.toLocaleString('en-US')}${isSellout(attendance) ? ' (sellout)' : ` of ${attendance.capacity.toLocaleString('en-US')}`}`;
}

/** Ticket money for the athletic department: a budget point per 12,000 fans through the gates, up to three. */
export const GATE_FANS_PER_POINT = 12000;
export const GATE_BONUS_CAP = 3;

export interface GateReceipts {
  /** Fans through the gates over the season. */
  totalFans: number;
  homeGames: number;
  sellouts: number;
  /** Extra investment budget points the gate earned. */
  bonus: number;
}

export function gateReceipts(season: SeasonAttendance | null): GateReceipts {
  if (!season) return { totalFans: 0, homeGames: 0, sellouts: 0, bonus: 0 };
  const totalFans = season.total;
  return {
    totalFans,
    homeGames: season.homeGames,
    sellouts: season.sellouts,
    bonus: Math.min(GATE_BONUS_CAP, Math.floor(totalFans / GATE_FANS_PER_POINT)),
  };
}
