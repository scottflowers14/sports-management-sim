import { isRedshirting, redshirtBlock } from '@sports-management-sim/engine-core';
import { LACROSSE_STARTER_COUNTS } from './depth-chart';
import type { LacrossePlayer, LacrossePosition, LacrosseTeam } from './models';

/** CPU staffs redshirt at most this many players a season. */
export const CPU_REDSHIRT_LIMIT = 4;

/** Players a position must keep in uniform: the starters plus one backup (two in goal). */
export function redshirtPositionFloor(position: LacrossePosition): number {
  return LACROSSE_STARTER_COUNTS[position] + (position === 'GK' ? 2 : 1);
}

export type LacrosseRedshirtBlock = ReturnType<typeof redshirtBlock> | 'depth';

/** Why this player can't redshirt right now, or null when he can. */
export function lacrosseRedshirtBlock(
  team: LacrosseTeam,
  player: LacrossePlayer,
  gamesPlayed: number,
): LacrosseRedshirtBlock {
  const block = redshirtBlock(player, gamesPlayed);
  if (block) return block;
  const available = team.roster.filter((p) => p.position === player.position && !isRedshirting(p)).length;
  if (available - 1 < redshirtPositionFloor(player.position)) return 'depth';
  return null;
}

export const REDSHIRT_BLOCK_LABELS: Record<NonNullable<LacrosseRedshirtBlock>, string> = {
  used: 'Already used his redshirt',
  graduate: 'Graduate students cannot redshirt',
  played: 'Has played too many games this season',
  depth: 'Too few players left at his position',
};

/** Start or end a redshirt. Ending one returns the year to him if he hasn't burned it. */
export function setLacrosseRedshirt(team: LacrosseTeam, playerId: string, redshirt: boolean, gamesPlayed: number): LacrosseTeam {
  const player = team.roster.find((p) => p.id === playerId);
  if (!player) return team;
  if (redshirt && lacrosseRedshirtBlock(team, player, gamesPlayed) !== null) return team;
  if (!redshirt && !isRedshirting(player)) return team;
  const status = redshirt ? 'redshirting' : 'redshirt_available';
  return { ...team, roster: team.roster.map((p) => (p.id === playerId ? { ...p, redshirtStatus: status } : p)) };
}

/**
 * Young players who won't see the field this year and would gain from a year
 * of practice: freshmen and sophomores buried below the rotation with room to
 * grow. Best candidates first.
 */
export function suggestRedshirts(team: LacrosseTeam, gamesPlayedFor: (playerId: string) => number = () => 0): LacrossePlayer[] {
  const picks: LacrossePlayer[] = [];
  let working = team;
  const candidates = team.roster
    .filter((p) => (p.classYear === 'FR' || p.classYear === 'SO') && !isRedshirting(p))
    .filter((p) => p.ratings.potential - p.ratings.overall >= 8)
    .filter((p) => {
      const rank = 1 + team.roster.filter((o) => o.position === p.position && o.ratings.overall > p.ratings.overall).length;
      return rank > LACROSSE_STARTER_COUNTS[p.position] * 2;
    })
    .sort((a, b) => (a.classYear === b.classYear ? 0 : a.classYear === 'FR' ? -1 : 1) || b.ratings.potential - a.ratings.potential || a.id.localeCompare(b.id));
  for (const player of candidates) {
    if (lacrosseRedshirtBlock(working, player, gamesPlayedFor(player.id)) !== null) continue;
    picks.push(player);
    working = setLacrosseRedshirt(working, player.id, true, 0);
  }
  return picks;
}

/** A CPU program's redshirt decisions before its first game. */
export function applyCpuRedshirts(team: LacrosseTeam): LacrosseTeam {
  if (team.roster.some(isRedshirting)) return team;
  return suggestRedshirts(team)
    .slice(0, CPU_REDSHIRT_LIMIT)
    .reduce((t, p) => setLacrosseRedshirt(t, p.id, true, 0), team);
}
