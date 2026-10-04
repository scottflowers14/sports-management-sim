import type { Player, PlayerClass } from './models';

/**
 * A player may still redshirt after appearing in this many games, like the
 * college football four-game rule. Past it, the season counts.
 */
export const REDSHIRT_GAME_LIMIT = 4;

/** A redshirt year adds to the offseason development roll (0–1 scale). */
export const REDSHIRT_DEVELOPMENT_BONUS = 0.25;

export type RedshirtBlock = 'used' | 'graduate' | 'played';

/** Why a player can't start a redshirt this season, or null when he can. */
export function redshirtBlock(player: Pick<Player, 'classYear' | 'redshirtStatus'>, gamesPlayed: number): RedshirtBlock | null {
  if (player.redshirtStatus === 'redshirt_used') return 'used';
  if (player.classYear === 'GR') return 'graduate';
  if (gamesPlayed > REDSHIRT_GAME_LIMIT) return 'played';
  return null;
}

export function isRedshirting(player: Pick<Player, 'redshirtStatus'>): boolean {
  return player.redshirtStatus === 'redshirting';
}

/** "RS-SO" for a player who has used his redshirt, "SO" otherwise. */
export function classLabel(player: { classYear: PlayerClass; redshirtStatus?: Player['redshirtStatus'] }): string {
  return player.redshirtStatus === 'redshirt_used' ? `RS-${player.classYear}` : player.classYear;
}

/** Seniors and graduate students leave after the season, unless they're redshirting it. */
export function isGraduating(player: Pick<Player, 'classYear' | 'redshirtStatus'>): boolean {
  return (player.classYear === 'SR' || player.classYear === 'GR') && !isRedshirting(player);
}
