import { isGraduating } from '@sports-management-sim/engine-core';
import type { LacrosseTeam } from './models';

/**
 * The pro league's college draft, in the spirit of the NFL Draft screen in
 * College Football dynasty: departing seniors and grad students from every
 * program are drafted by the pro clubs, and programs that send players to the
 * pros earn a bump in national prestige.
 */
export const PRO_TEAMS = [
  'Harbor Hawks',
  'Summit Storm',
  'Capital Captains',
  'Bayside Blaze',
  'Iron City Forge',
  'Lakeshore Lynx',
  'Desert Dragons',
  'Northwoods Wolves',
] as const;

export const PRO_DRAFT_ROUNDS = 4;

/** Players below this overall go undrafted, however thin the class. */
const DRAFTABLE_OVERALL = 60;
/** How far a scout's grade can wander from the ratings, either way. */
const SCOUTING_NOISE = 4;
/** A big final season is worth up to this many overall points on draft boards. */
const MAX_PRODUCTION_BONUS = 6;
/** The pros carry few specialists, so only so many go in any draft. */
const POSITION_LIMITS: Partial<Record<string, number>> = { GK: 3, FOGO: 4 };

export interface ProDraftPick {
  year: number;
  round: number;
  /** Pick within the round, from 1. */
  pick: number;
  overallPick: number;
  proTeam: string;
  playerId: string;
  name: string;
  position: string;
  overall: number;
  collegeTeamId: string;
}

export interface ProDraftOptions {
  year: number;
  seed: number;
  /** Final-season production on a 0 to 10 scale, by player id; see draftProductionScore. */
  productionByPlayerId?: Record<string, number>;
}

/** The draft board grade: ratings first, with a final-season bonus. */
export function draftGrade(overall: number, production = 0): number {
  return overall + Math.min(MAX_PRODUCTION_BONUS, Math.max(0, production) * (MAX_PRODUCTION_BONUS / 10));
}

export function runProDraft(teams: LacrosseTeam[], { year, seed, productionByPlayerId = {} }: ProDraftOptions): ProDraftPick[] {
  const random = seededRandom(hash(`pro-draft:${year}:${seed}`));
  const board = teams
    .flatMap((team) =>
      team.roster
        .filter((player) => isGraduating(player) && player.ratings.overall >= DRAFTABLE_OVERALL)
        .map((player) => ({
          player,
          collegeTeamId: team.id,
          grade: draftGrade(player.ratings.overall, productionByPlayerId[player.id]) + (random() * 2 - 1) * SCOUTING_NOISE,
        })),
    )
    .sort((a, b) => b.grade - a.grade || a.player.id.localeCompare(b.player.id));

  const order = shuffle([...PRO_TEAMS], random);
  const taken = new Map<string, number>();
  const picks: ProDraftPick[] = [];
  let next = 0;
  for (let round = 1; round <= PRO_DRAFT_ROUNDS; round += 1) {
    for (let pick = 1; pick <= order.length; pick += 1) {
      while (next < board.length) {
        const position = board[next]!.player.position;
        const limit = POSITION_LIMITS[position];
        if (limit === undefined || (taken.get(position) ?? 0) < limit) break;
        next += 1;
      }
      const prospect = board[next];
      if (!prospect) return picks;
      next += 1;
      const { player } = prospect;
      taken.set(player.position, (taken.get(player.position) ?? 0) + 1);
      picks.push({
        year,
        round,
        pick,
        overallPick: picks.length + 1,
        proTeam: order[pick - 1]!,
        playerId: player.id,
        name: `${player.name.first} ${player.name.last}`,
        position: player.position,
        overall: player.ratings.overall,
        collegeTeamId: prospect.collegeTeamId,
      });
    }
  }
  return picks;
}

/**
 * Sending a player to the pros in the first round lifts national prestige a
 * point. One point, not one per pick: a probe of six drafts showed bigger
 * boosts inflating league-wide prestige faster than it reverts.
 */
export function proDraftPrestigeBoost(picks: ProDraftPick[], teamId: string): number {
  return picks.some((p) => p.collegeTeamId === teamId && p.round === 1) ? 1 : 0;
}

export function applyProDraftPrestige(teams: LacrosseTeam[], picks: ProDraftPick[]): LacrosseTeam[] {
  return teams.map((team) => {
    const boost = proDraftPrestigeBoost(picks, team.id);
    if (boost === 0) return team;
    return { ...team, reputation: { ...team.reputation, nationalPrestige: Math.min(99, team.reputation.nationalPrestige + boost) } };
  });
}

/** "Round 1, pick 3" or "Round 2, pick 1 (9th overall)". */
export function draftSlotLabel(pick: Pick<ProDraftPick, 'round' | 'pick' | 'overallPick'>): string {
  return pick.round === 1 ? `Round 1, pick ${pick.pick}` : `Round ${pick.round}, pick ${pick.pick} (${ordinal(pick.overallPick)} overall)`;
}

/** 1st, 2nd, 3rd, 11th, 22nd... */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
