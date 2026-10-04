import type { Conference } from '@sports-management-sim/engine-core';
import type { LacrosseTeam } from './models';
import type { Rivalry } from './rivalries';

/**
 * Conference realignment, in the spirit of College Football dynasty: now and
 * then a rising pair of rivals trades places with a fading pair in a stronger
 * league. Rivals always move together, so every trophy game stays a
 * conference game and every conference keeps its size.
 */
export interface RealignmentMove {
  year: number;
  /** The rising pair, moving up. */
  risingTeamIds: [string, string];
  /** The fading pair, moving down to take their place. */
  fadingTeamIds: [string, string];
  /** The rising pair's old league. */
  fromConferenceId: string;
  /** The stronger league they join. */
  toConferenceId: string;
}

/** Chance a realignment happens in an offseason with a strong enough case. */
export const REALIGNMENT_CHANCE = 0.35;
/** How much more prestige the rising pair must carry than the pair it replaces. */
export const REALIGNMENT_PRESTIGE_GAP = 8;

export interface RealignmentInput {
  conferences: readonly Conference[];
  teams: readonly LacrosseTeam[];
  rivalries: readonly Rivalry[];
  year: number;
  seed: number;
  /** The user's program never gets pushed down; it can only be invited up. */
  userTeamId: string;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function conferenceStrength(conference: Pick<Conference, 'teamIds'>, prestigeOf: (id: string) => number): number {
  if (conference.teamIds.length === 0) return 0;
  return conference.teamIds.reduce((sum, id) => sum + prestigeOf(id), 0) / conference.teamIds.length;
}

/** The strongest case for a move, ignoring the dice. */
export function bestRealignmentCase(input: Omit<RealignmentInput, 'seed'>): RealignmentMove | null {
  const prestige = new Map(input.teams.map((t) => [t.id, t.reputation.nationalPrestige]));
  const prestigeOf = (id: string) => prestige.get(id) ?? 0;
  const pairPrestige = (r: Rivalry) => (prestigeOf(r.teamIds[0]) + prestigeOf(r.teamIds[1])) / 2;
  const pairsIn = (conference: Conference) =>
    input.rivalries.filter((r) => conference.teamIds.includes(r.teamIds[0]) && conference.teamIds.includes(r.teamIds[1]));
  // Every member must be in a rivalry pair, or a swap could orphan someone.
  const swappable = input.conferences.filter((c) => pairsIn(c).length * 2 === c.teamIds.length);

  let best: { move: RealignmentMove; gap: number } | null = null;
  for (const lower of swappable) {
    for (const upper of swappable) {
      if (upper === lower || conferenceStrength(upper, prestigeOf) <= conferenceStrength(lower, prestigeOf)) continue;
      const fading = pairsIn(upper).filter((r) => !r.teamIds.includes(input.userTeamId));
      for (const rising of pairsIn(lower)) {
        for (const pair of fading) {
          const gap = pairPrestige(rising) - pairPrestige(pair);
          if (gap < REALIGNMENT_PRESTIGE_GAP || (best && gap <= best.gap)) continue;
          best = {
            gap,
            move: {
              year: input.year,
              risingTeamIds: [...rising.teamIds],
              fadingTeamIds: [...pair.teamIds],
              fromConferenceId: lower.id,
              toConferenceId: upper.id,
            },
          };
        }
      }
    }
  }
  return best?.move ?? null;
}

/** This offseason's move, if the case is strong enough and the dice agree. */
export function planRealignment(input: RealignmentInput): RealignmentMove | null {
  const roll = hash(`realign:${input.year}:${input.seed}`) / 0x1_0000_0000;
  if (roll >= REALIGNMENT_CHANCE) return null;
  return bestRealignmentCase(input);
}

export function realignmentInvolves(move: RealignmentMove, teamId: string): boolean {
  return move.risingTeamIds.includes(teamId) || move.fadingTeamIds.includes(teamId);
}

/** Swaps the two pairs between their conferences. */
export function applyRealignment<C extends Pick<Conference, 'id' | 'teamIds'>>(
  conferences: readonly C[],
  teams: readonly LacrosseTeam[],
  move: RealignmentMove,
): { conferences: C[]; teams: LacrosseTeam[] } {
  const rising = new Set(move.risingTeamIds);
  const fading = new Set(move.fadingTeamIds);
  const nextConferences = conferences.map((c) => {
    if (c.id === move.fromConferenceId) return { ...c, teamIds: [...c.teamIds.filter((id) => !rising.has(id)), ...move.fadingTeamIds] };
    if (c.id === move.toConferenceId) return { ...c, teamIds: [...c.teamIds.filter((id) => !fading.has(id)), ...move.risingTeamIds] };
    return c;
  });
  const nextTeams = teams.map((t) => {
    if (rising.has(t.id)) return { ...t, conferenceId: move.toConferenceId };
    if (fading.has(t.id)) return { ...t, conferenceId: move.fromConferenceId };
    return t;
  });
  return { conferences: nextConferences, teams: nextTeams };
}

export function realignmentHeadline(
  move: RealignmentMove,
  teamName: (id: string) => string,
  conferenceName: (id: string) => string,
): string {
  const [a, b] = move.risingTeamIds.map(teamName);
  const [c, d] = move.fadingTeamIds.map(teamName);
  return `Realignment: ${a} and ${b} jump from the ${conferenceName(move.fromConferenceId)} to the ${conferenceName(move.toConferenceId)}; ${c} and ${d} head the other way`;
}
