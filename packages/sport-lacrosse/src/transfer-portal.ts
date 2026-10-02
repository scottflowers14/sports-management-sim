import {
  applyPortalResolution,
  generateCpuPortalOffers,
  openTransferPortal,
  resolvePortalCommitments,
  type PortalEntry,
  type PortalMove,
} from '@sports-management-sim/engine-core';
import { getLacrosseDepthChart, LACROSSE_STARTER_COUNTS } from './depth-chart';
import type { LacrossePlayerTraits, LacrossePosition, LacrosseTeam } from './models';

export type LacrossePortalEntry = PortalEntry<LacrossePosition, LacrossePlayerTraits>;

/** NCAA men's lacrosse roster limit; nobody shops the portal past it. */
export const LACROSSE_ROSTER_LIMIT = 48;

/** A CPU program stops shopping a position once it holds this many there. */
export const LACROSSE_PORTAL_POSITION_CAPS: Record<LacrossePosition, number> = {
  ATT: 9,
  MID: 17,
  DEF: 11,
  GK: 4,
  FOGO: 3,
  LSM: 4,
};

export interface OpenLacrossePortalOptions {
  seed: number;
  season: number;
}

export interface OpenLacrossePortalResult {
  teams: LacrosseTeam[];
  entries: LacrossePortalEntry[];
}

/**
 * Open the portal after the offseason roster turnover: every program's depth
 * chart decides who leaves, and the entrants come off their rosters.
 */
export function openLacrossePortal(teams: LacrosseTeam[], options: OpenLacrossePortalOptions): OpenLacrossePortalResult {
  const random = seededRandom(options.seed + 777);
  const depthCharts = new Map(teams.map((team) => [team.id, getLacrosseDepthChart(team)]));
  return openTransferPortal(teams, {
    season: options.season,
    random,
    startersAt: (position) => LACROSSE_STARTER_COUNTS[position],
    depthRankFor: (team, player) => {
      const order = depthCharts.get(team.id)?.[player.position] ?? [];
      const index = order.indexOf(player.id);
      return index === -1 ? order.length + 1 : index + 1;
    },
  });
}

export interface LacrosseCpuPortalOptions {
  seed: number;
  /** The user's program makes its own offers. */
  userTeamId?: string;
}

/** CPU programs make their portal offers; the user's program is left to the player. */
export function generateLacrosseCpuPortalOffers(
  entries: LacrossePortalEntry[],
  teams: LacrosseTeam[],
  options: LacrosseCpuPortalOptions,
): LacrossePortalEntry[] {
  return generateCpuPortalOffers(entries, teams, {
    random: seededRandom(options.seed + 991),
    startersAt: (position) => LACROSSE_STARTER_COUNTS[position],
    rosterLimit: LACROSSE_ROSTER_LIMIT,
    skipTeamIds: options.userTeamId ? [options.userTeamId] : [],
    positionCapFor: (_team, position) => LACROSSE_PORTAL_POSITION_CAPS[position],
  });
}

export interface ResolveLacrossePortalResult {
  teams: LacrosseTeam[];
  entries: LacrossePortalEntry[];
  moves: PortalMove[];
}

/** Every transfer still deciding picks a school (or goes home), and rosters update. */
export function resolveLacrossePortal(
  entries: LacrossePortalEntry[],
  teams: LacrosseTeam[],
  season: number,
): ResolveLacrossePortalResult {
  const resolved = resolvePortalCommitments(entries, teams);
  const applied = applyPortalResolution(teams, resolved, season);
  return { teams: applied.teams, entries: resolved, moves: applied.moves };
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
