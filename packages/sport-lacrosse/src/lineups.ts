import { getLacrosseOrderedPlayers } from './depth-chart';
import { normalizeGamePlan, ROTATION_SHARES, type LacrosseGamePlan, type MidfieldRotation } from './game-plan';
import type { LacrossePlayer, LacrosseTeam } from './models';

/**
 * The units a team actually sends onto the field, built from the depth chart.
 * Attack and close defense stay on for their half of the game, the midfield
 * lines rotate by the game plan, and the special-teams units are the best six
 * (man-up) and five (man-down) the roster can put together.
 */
export interface LacrosseLineup {
  attack: LacrossePlayer[];
  midfieldLines: LacrossePlayer[][];
  closeDefense: LacrossePlayer[];
  longStickMid: LacrossePlayer | null;
  goalie: LacrossePlayer | null;
  /** Faceoff specialists, starter first. */
  faceoff: LacrossePlayer[];
  manUp: LacrossePlayer[];
  manDown: LacrossePlayer[];
}

export const MIDFIELD_LINE_SIZE = 3;
export const MAX_MIDFIELD_LINES = 3;

export function buildLacrosseLineup(team: LacrosseTeam): LacrosseLineup {
  const attackers = getLacrosseOrderedPlayers(team, 'ATT');
  const mids = getLacrosseOrderedPlayers(team, 'MID');
  const defenders = getLacrosseOrderedPlayers(team, 'DEF');
  const lsms = getLacrosseOrderedPlayers(team, 'LSM');
  const goalies = getLacrosseOrderedPlayers(team, 'GK');
  const fogos = getLacrosseOrderedPlayers(team, 'FOGO');

  const attack = fill(3, attackers, mids.slice(MIDFIELD_LINE_SIZE * 2), mids);
  const closeDefense = fill(3, defenders, lsms.slice(1), mids.slice(MIDFIELD_LINE_SIZE * 2).reverse());
  const longStickMid = lsms[0] ?? defenders[3] ?? null;
  const goalie = goalies[0] ?? null;
  const faceoff = fogos.length > 0 ? fogos.slice(0, 2) : bestBy(mids, (p) => p.sportTraits.faceoffs ?? p.sportTraits.groundBalls).slice(0, 1);

  const used = new Set([...attack, ...closeDefense].map((p) => p.id));
  const linePool = [
    ...mids,
    ...attackers.filter((p) => !used.has(p.id)),
    ...lsms.filter((p) => p !== longStickMid),
    ...defenders.filter((p) => !used.has(p.id)),
  ].filter((p) => !used.has(p.id));
  const midfieldLines: LacrossePlayer[][] = [];
  for (let line = 0; line < MAX_MIDFIELD_LINES; line += 1) {
    const players = linePool.slice(line * MIDFIELD_LINE_SIZE, (line + 1) * MIDFIELD_LINE_SIZE);
    if (players.length === 0) break;
    // A short last line borrows from the first so three men always go out.
    while (players.length < MIDFIELD_LINE_SIZE && midfieldLines[0] && players.length < midfieldLines[0].length) {
      players.push(midfieldLines[0][players.length]!);
    }
    midfieldLines.push(players);
  }
  if (midfieldLines.length === 0 && attack.length > 0) midfieldLines.push(attack);

  const offensivePool = [...attack, ...midfieldLines.flat()];
  const manUp = unique(bestBy(offensivePool, manUpScore)).slice(0, 6);
  // Man-down keeps the close defense and the pole on, then the best defensive mid.
  const manDown = fill(
    5,
    closeDefense,
    longStickMid ? [longStickMid] : [],
    bestBy([...midfieldLines.flat(), ...lsms.slice(1), ...defenders.slice(3)], manDownScore),
  );

  return { attack, midfieldLines, closeDefense, longStickMid, goalie, faceoff, manUp, manDown };
}

/** Share of midfield shifts each line gets under a rotation plan. */
export function midfieldLineShares(lineCount: number, rotation: MidfieldRotation): number[] {
  const shares = ROTATION_SHARES[rotation].slice(0, Math.max(1, lineCount));
  const total = shares.reduce((s, v) => s + v, 0);
  return shares.map((s) => s / total);
}

/**
 * Share of a game (0–1) each player on the depth chart is on the field, from
 * the units and the midfield rotation. Players who never dress get nothing.
 * Injury risk follows this, so it reflects a typical game rather than one
 * specific sim.
 */
export function getLacrosseParticipationMinutes(team: LacrosseTeam, plan?: Partial<LacrosseGamePlan> | null): Map<string, number> {
  const lineup = buildLacrosseLineup(team);
  const rotation = normalizeGamePlan(plan).rotation;
  const minutes = new Map<string, number>();
  const bump = (player: LacrossePlayer | null | undefined, share: number) => {
    if (!player) return;
    minutes.set(player.id, Math.min(1, (minutes.get(player.id) ?? 0) + share));
  };
  // Attack and close defense play every possession on their end: half the game.
  // The scale matches the old participation table, which the injury rate was tuned to.
  lineup.attack.forEach((p, i) => bump(p, [1, 1, 0.95][i] ?? 0.9));
  lineup.closeDefense.forEach((p) => bump(p, 1));
  bump(lineup.longStickMid, 0.85);
  bump(lineup.goalie, 1);
  lineup.faceoff.forEach((p, i) => bump(p, i === 0 ? 0.3 : 0.06));
  const shares = midfieldLineShares(lineup.midfieldLines.length, rotation);
  lineup.midfieldLines.forEach((line, i) => line.forEach((p) => bump(p, Math.min(1, (shares[i] ?? 0) * 1.3))));
  return minutes;
}

function manUpScore(player: LacrossePlayer): number {
  return player.sportTraits.shooting * 0.45 + player.sportTraits.passing * 0.3 + player.sportTraits.offBallMovement * 0.25;
}

function manDownScore(player: LacrossePlayer): number {
  return player.sportTraits.defense * 0.55 + player.ratings.iq * 0.25 + player.ratings.athleticism * 0.2;
}

function bestBy(players: LacrossePlayer[], score: (player: LacrossePlayer) => number): LacrossePlayer[] {
  return [...players].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
}

function unique(players: LacrossePlayer[]): LacrossePlayer[] {
  const seen = new Set<string>();
  return players.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

/** Take `count` players from the sources in order, never the same player twice. */
function fill(count: number, ...sources: LacrossePlayer[][]): LacrossePlayer[] {
  const out: LacrossePlayer[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    for (const player of source) {
      if (out.length >= count) return out;
      if (seen.has(player.id)) continue;
      seen.add(player.id);
      out.push(player);
    }
  }
  return out;
}
