import { getLacrosseDepthChart, LACROSSE_STARTER_COUNTS } from './depth-chart';
import type { LacrossePlayer, LacrosseTeam } from './models';
import type { PracticeIntensity } from './practice';

/** Where morale settles when nothing is happening. */
export const MORALE_BASELINE = 62;
/** Share of the gap to the baseline that closes each week. */
const MORALE_DRIFT = 0.08;
/** A talk lifts a player this much, once a season. */
export const PLAYER_TALK_BOOST = 10;
/** A team meeting lifts everyone this much. */
export const TEAM_MEETING_BOOST = 4;
/** Weeks between team meetings; more often and players tune them out. */
export const TEAM_MEETING_COOLDOWN = 4;

export type LacrosseRole = 'starter' | 'rotation' | 'reserve';
export type MoodLabel = 'Delighted' | 'Happy' | 'Content' | 'Unhappy' | 'Furious';

const ROLE_ORDER: Record<LacrosseRole, number> = { starter: 0, rotation: 1, reserve: 2 };

function roleForRank(rank: number, starters: number): LacrosseRole {
  if (rank <= starters) return 'starter';
  if (rank <= starters * 2) return 'rotation';
  return 'reserve';
}

export interface PlayerRoleStatus {
  /** The role his rating earns him among teammates at his position. */
  expected: LacrosseRole;
  /** The role the depth chart gives him. */
  actual: LacrosseRole;
}

/**
 * A player judges his role against his teammates at the position: the best
 * three attackmen expect to start. When the depth chart puts him lower than
 * his rating earns, he notices.
 */
export function playerRoleStatus(team: LacrosseTeam, player: LacrossePlayer): PlayerRoleStatus {
  const starters = LACROSSE_STARTER_COUNTS[player.position];
  // Ties share a rank: nobody expects to beat out a teammate rated the same.
  // Redshirting teammates aren't competing for the job this year.
  const ratingRank =
    1 +
    team.roster.filter(
      (p) => p.position === player.position && p.redshirtStatus !== 'redshirting' && p.ratings.overall > player.ratings.overall,
    ).length;
  const order = getLacrosseDepthChart(team)[player.position];
  const depthRank = order.indexOf(player.id) + 1 || order.length + 1;
  return { expected: roleForRank(ratingRank, starters), actual: roleForRank(depthRank, starters) };
}

export interface MoraleWeekInput {
  /** True for a win, false for a loss, null for a bye. */
  won: boolean | null;
  intensity: PracticeIntensity;
  /** A rivalry game counts triple, win or lose. */
  rivalry?: boolean;
}

/** One player's weekly change, before drift. */
export function weeklyMoraleChange(player: LacrossePlayer, status: PlayerRoleStatus, input: MoraleWeekInput): number {
  let change = 0;
  const benchedBy = ROLE_ORDER[status.actual] - ROLE_ORDER[status.expected];
  if (player.redshirtStatus === 'redshirting') {
    // A redshirt is a plan he signed up for, not a benching.
    change += 0.6;
  } else if (benchedBy > 0) {
    // Seniors take a benching harder than freshmen.
    change -= 3 * benchedBy * (player.classYear === 'SR' || player.classYear === 'GR' ? 1.3 : 1);
  } else if (status.actual === 'starter') {
    change += 1;
  } else if (status.actual === 'rotation') {
    change += 0.3;
  } else if (player.classYear !== 'FR') {
    change -= 0.6;
  }
  const stakes = input.rivalry ? 3 : 1;
  if (input.won === true) change += 0.8 * stakes;
  if (input.won === false) change -= 0.8 * stakes;
  if (input.intensity === 'intense') change -= 1;
  if (input.intensity === 'light') change += 0.5;
  if (player.traits.includes('leader')) change += 0.3;
  if (player.traits.includes('low_motivation')) change -= 0.3;
  return change;
}

export interface MoraleChange {
  playerId: string;
  from: number;
  to: number;
}

/** A team names up to this many captains. */
export const MAX_CAPTAINS = 2;
/** Being named captain lifts a player this much. */
export const CAPTAIN_NAMED_BOOST = 8;

/** The team's captains still on the roster. */
export function teamCaptains(team: LacrosseTeam): LacrossePlayer[] {
  const ids = new Set(team.captainIds ?? []);
  return team.roster.filter((p) => ids.has(p.id));
}

/**
 * What the captains do for everyone else each week. A respected, happy
 * captain steadies the room; an unhappy one spreads it. Leadership 50 is
 * neutral, so naming the wrong player can cost you.
 */
export function captainInfluence(team: LacrosseTeam): number {
  let influence = 0;
  for (const captain of teamCaptains(team)) {
    const pull = (captain.ratings.leadership - 50) / 50;
    influence += captain.morale >= 50 ? pull * 0.35 : -Math.abs(pull) * 0.35 - 0.3;
  }
  return Math.max(-1, Math.min(1, Math.round(influence * 100) / 100));
}

/** Name or remove a captain. Naming one beyond the limit does nothing. */
export function setCaptain(team: LacrosseTeam, playerId: string, captain: boolean): LacrosseTeam {
  const current = teamCaptains(team).map((p) => p.id);
  if (captain) {
    if (current.includes(playerId) || current.length >= MAX_CAPTAINS) return team;
    if (!team.roster.some((p) => p.id === playerId)) return team;
    const named = { ...team, captainIds: [...current, playerId] };
    return boostMorale(named, new Set([playerId]), CAPTAIN_NAMED_BOOST);
  }
  if (!current.includes(playerId)) return team;
  return { ...team, captainIds: current.filter((id) => id !== playerId) };
}

/** The players a staff would pick: the best leaders among the upperclassmen. */
export function suggestCaptains(team: LacrosseTeam, count = MAX_CAPTAINS): LacrossePlayer[] {
  const upperclassmen = team.roster.filter((p) => p.classYear !== 'FR' && p.classYear !== 'SO');
  const pool = upperclassmen.length >= count ? upperclassmen : team.roster;
  return [...pool]
    .sort((a, b) => b.ratings.leadership - a.ratings.leadership || b.ratings.overall - a.ratings.overall || a.id.localeCompare(b.id))
    .slice(0, count);
}

/** A CPU program names its captains before the opener if it has none. */
export function applyCpuCaptains(team: LacrosseTeam): LacrosseTeam {
  if (teamCaptains(team).length > 0) return team;
  return { ...team, captainIds: suggestCaptains(team).map((p) => p.id) };
}

/** A week of morale for a whole team. */
export function runMoraleWeek(team: LacrosseTeam, input: MoraleWeekInput): { team: LacrosseTeam; changes: MoraleChange[] } {
  const changes: MoraleChange[] = [];
  const captainIds = new Set(teamCaptains(team).map((p) => p.id));
  const influence = captainInfluence(team);
  const roster = team.roster.map((player) => {
    const status = playerRoleStatus(team, player);
    const drift = (MORALE_BASELINE - player.morale) * MORALE_DRIFT;
    // Captains don't lift themselves.
    const fromCaptains = captainIds.has(player.id) ? 0 : influence;
    const next = clampMorale(player.morale + weeklyMoraleChange(player, status, input) + drift + fromCaptains);
    if (next === player.morale) return player;
    changes.push({ playerId: player.id, from: player.morale, to: next });
    return { ...player, morale: next };
  });
  return { team: changes.length === 0 ? team : { ...team, roster }, changes };
}

/** Lift one player's or several players' morale, e.g. after a talk or a team meeting. */
export function boostMorale(team: LacrosseTeam, playerIds: ReadonlySet<string> | 'all', amount: number): LacrosseTeam {
  return {
    ...team,
    roster: team.roster.map((p) =>
      playerIds === 'all' || playerIds.has(p.id) ? { ...p, morale: clampMorale(p.morale + amount) } : p,
    ),
  };
}

export function moodLabel(morale: number): MoodLabel {
  if (morale >= 85) return 'Delighted';
  if (morale >= 70) return 'Happy';
  if (morale >= 50) return 'Content';
  if (morale >= 35) return 'Unhappy';
  return 'Furious';
}

/** Happy players work harder at practice: 0.85x at rock bottom, 1.15x at the top. */
export function moraleDevelopmentMultiplier(morale: number): number {
  return 0.85 + (clampMorale(morale) / 100) * 0.3;
}

/** The locker room: the roster's average morale, rounded. */
export function teamChemistry(team: LacrosseTeam): number {
  if (team.roster.length === 0) return MORALE_BASELINE;
  return Math.round(team.roster.reduce((sum, p) => sum + p.morale, 0) / team.roster.length);
}

/** Why a player feels the way he does, in a few words. */
export function moraleReason(team: LacrosseTeam, player: LacrossePlayer): string {
  if (player.redshirtStatus === 'redshirting') return 'Redshirting this season';
  const status = playerRoleStatus(team, player);
  const benchedBy = ROLE_ORDER[status.actual] - ROLE_ORDER[status.expected];
  if (benchedBy > 0) return status.expected === 'starter' ? 'Thinks he should be starting' : 'Wants more playing time';
  if (status.actual === 'starter') return 'Happy starting';
  if (status.actual === 'rotation') return 'Content in the rotation';
  return player.classYear === 'FR' ? 'Patient, waiting his turn' : 'Would like a bigger role';
}

/** Morale keeps one decimal so small weekly nudges add up; screens round it. */
function clampMorale(value: number): number {
  return Math.min(99, Math.max(1, Math.round(value * 10) / 10));
}
