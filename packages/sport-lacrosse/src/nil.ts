import type { PortalReason } from '@sports-management-sim/engine-core';
import type { LacrosseTeam } from './models';
import type { LacrossePortalEntry } from './transfer-portal';

/**
 * The NIL collective, in the spirit of College Football 26: boosters give the
 * program a pot of name-image-likeness money each offseason. It can keep a
 * player who just entered the portal, or sweeten a portal offer.
 */
export interface NilState {
  /** The season the money is for (the portal that opens before it). */
  year: number;
  budget: number;
  deals: NilDeal[];
}

export interface NilDeal {
  entryId: string;
  kind: 'retain' | 'portal';
  amount: number;
  /** Retention pitches land or fail on the spot; portal deals stay pending. */
  outcome: 'retained' | 'declined' | 'pending';
}

const ROUND_TO = 5_000;
const round = (dollars: number) => Math.round(dollars / ROUND_TO) * ROUND_TO;

/** Big brands raise more: about $300k at prestige 50, $420k at 80. */
export function nilCollectiveBudget(team: Pick<LacrosseTeam, 'reputation'>): number {
  return round(100_000 + team.reputation.nationalPrestige * 4_000);
}

/** What a player's name is worth on the open market. */
export function nilValue(overall: number): number {
  return round(Math.max(10_000, 10_000 + (overall - 50) * 8_000));
}

/** Money talks loudest to a player who left over money. */
export const NIL_RETENTION_PRICE: Record<PortalReason, number> = {
  playing_time: 1.2,
  bigger_stage: 1.4,
  closer_to_home: 1,
  scholarship: 0.8,
};

/** Chance a retention deal keeps the player home. */
export const NIL_RETENTION_ODDS: Record<PortalReason, number> = {
  playing_time: 0.45,
  bigger_stage: 0.55,
  closer_to_home: 0.5,
  scholarship: 0.9,
};

/** How much a portal NIL deal lifts the transfer's interest in us. */
export const NIL_PORTAL_INTEREST_BOOST = 20;

export function nilRetentionAsk(entry: Pick<LacrossePortalEntry, 'ratings' | 'reason'>): number {
  return round(nilValue(entry.ratings.overall) * NIL_RETENTION_PRICE[entry.reason]);
}

export function nilPortalDealCost(entry: Pick<LacrossePortalEntry, 'ratings'>): number {
  return round(nilValue(entry.ratings.overall) / 2);
}

export function nilSpent(state: NilState): number {
  return state.deals.filter((d) => d.outcome !== 'declined').reduce((sum, d) => sum + d.amount, 0);
}

export function nilRemaining(state: NilState): number {
  return state.budget - nilSpent(state);
}

export function nilDealFor(state: NilState, entryId: string): NilDeal | undefined {
  return state.deals.find((d) => d.entryId === entryId);
}

/**
 * A fixed roll per player and season, so reloading a save and pitching again
 * gives the same answer.
 */
export function nilRetentionRoll(entryId: string, seed: number): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < entryId.length; i += 1) {
    h = Math.imul(h ^ entryId.charCodeAt(i), 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
  }
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 0x1_0000_0000;
}

/** Takes a player out of the portal and puts him back on his roster. */
export function returnPortalPlayer(
  teams: LacrosseTeam[],
  entries: LacrossePortalEntry[],
  entryId: string,
): { teams: LacrosseTeam[]; entries: LacrossePortalEntry[] } | null {
  const entry = entries.find((e) => e.id === entryId);
  if (!entry || entry.status !== 'available') return null;
  const nextTeams = teams.map((team) => {
    if (team.id !== entry.sourceTeamId) return team;
    const roster = [...team.roster, entry.player];
    const scholarshipUsed = Math.round(roster.reduce((sum, p) => sum + p.scholarshipPercent / 100, 0) * 100) / 100;
    return { ...team, roster, resources: { ...team.resources, scholarshipUsed } };
  });
  return { teams: nextTeams, entries: entries.filter((e) => e.id !== entryId) };
}

export interface RetentionResult {
  state: NilState;
  teams: LacrosseTeam[];
  entries: LacrossePortalEntry[];
  retained: boolean;
}

/**
 * Offer a player who left the user's program his retention price. Refused when
 * he isn't ours, was already pitched, or the collective can't cover it. A
 * player who says no keeps the money in the collective.
 */
export function pitchNilRetention(
  state: NilState,
  teams: LacrosseTeam[],
  entries: LacrossePortalEntry[],
  entryId: string,
  userTeamId: string,
  seed: number,
): RetentionResult | null {
  const entry = entries.find((e) => e.id === entryId);
  if (!entry || entry.status !== 'available' || entry.sourceTeamId !== userTeamId) return null;
  if (nilDealFor(state, entryId)) return null;
  const amount = nilRetentionAsk(entry);
  if (amount > nilRemaining(state)) return null;
  const retained = nilRetentionRoll(entryId, seed) < NIL_RETENTION_ODDS[entry.reason];
  const deal: NilDeal = { entryId, kind: 'retain', amount, outcome: retained ? 'retained' : 'declined' };
  const nextState = { ...state, deals: [...state.deals, deal] };
  if (!retained) return { state: nextState, teams, entries, retained };
  const back = returnPortalPlayer(teams, entries, entryId)!;
  return { state: nextState, ...back, retained };
}

/**
 * Add NIL money to an open portal offer. The transfer's interest in us jumps
 * right away; withdrawing the offer later refunds the money.
 */
export function signNilPortalDeal(
  state: NilState,
  entries: LacrossePortalEntry[],
  entryId: string,
  userTeamId: string,
): { state: NilState; entries: LacrossePortalEntry[] } | null {
  const entry = entries.find((e) => e.id === entryId);
  if (!entry || entry.status !== 'available' || entry.sourceTeamId === userTeamId) return null;
  if (entry.offersByTeamId[userTeamId] === undefined || nilDealFor(state, entryId)) return null;
  const amount = nilPortalDealCost(entry);
  if (amount > nilRemaining(state)) return null;
  const interest = Math.min(100, (entry.interestByTeamId[userTeamId] ?? 0) + NIL_PORTAL_INTEREST_BOOST);
  return {
    state: { ...state, deals: [...state.deals, { entryId, kind: 'portal', amount, outcome: 'pending' }] },
    entries: entries.map((e) => (e.id === entryId ? { ...e, interestByTeamId: { ...e.interestByTeamId, [userTeamId]: interest } } : e)),
  };
}

/** Drops a pending portal deal, refunding the collective. */
export function cancelNilPortalDeal(state: NilState, entryId: string): NilState {
  const deal = nilDealFor(state, entryId);
  if (!deal || deal.kind !== 'portal') return state;
  return { ...state, deals: state.deals.filter((d) => d !== deal) };
}

export function formatNil(dollars: number): string {
  return dollars >= 1_000_000 ? `$${(dollars / 1_000_000).toFixed(2)}M` : `$${Math.round(dollars / 1_000)}k`;
}
