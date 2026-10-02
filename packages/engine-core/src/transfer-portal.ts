import type { EligibilityStatus, ID, PersonName, Player, PlayerClass, PlayerRatings, Rating, RegionId, SeasonYear, Team } from './models';
import type { RecruitPreferences } from './recruiting';

export type PortalStatus = 'available' | 'committed' | 'withdrawn';

/** Why a player put their name in the portal; it also shapes what they look for next. */
export type PortalReason = 'playing_time' | 'bigger_stage' | 'closer_to_home' | 'scholarship';

export const PORTAL_REASON_LABELS: Record<PortalReason, string> = {
  playing_time: 'Wants playing time',
  bigger_stage: 'Seeking a bigger stage',
  closer_to_home: 'Wants to be closer to home',
  scholarship: 'Looking for a scholarship',
};

export interface PortalEntry<Position extends string = string, SportTraits = unknown> {
  id: string;
  playerId: ID;
  name: PersonName;
  position: Position;
  classYear: PlayerClass;
  ratings: PlayerRatings;
  sportTraits?: SportTraits;
  sourceTeamId: ID;
  regionId: RegionId;
  status: PortalStatus;
  preferences: RecruitPreferences;
  interestByTeamId: Record<ID, Rating>;
  offersByTeamId: Record<ID, number>;
  committedTeamId?: ID;
  /** The full player record; it leaves the source roster on entry and lands wherever they commit. */
  player: Player<Position, SportTraits>;
  reason: PortalReason;
  enteredSeason: SeasonYear;
  eligibility: EligibilityStatus;
}

// ── Entering the portal ───────────────────────────────────────────────────────

export interface PortalEntryDecisionInput {
  /** 1-based spot on the depth chart at the player's position. */
  depthRank: number;
  /** How many at that position start. */
  starters: number;
  random: () => number;
}

/** Base chance of entering by role on the depth chart. */
const ENTRY_CHANCE = { starter: 0.03, rotation: 0.07, buried: 0.12 } as const;
/** A starter this good at a program this modest gets looked at by bigger schools. */
const BIGGER_STAGE_OVERALL = 68;
const BIGGER_STAGE_PRESTIGE = 55;
const BIGGER_STAGE_CHANCE = 0.07;
const AWAY_FROM_HOME_CHANCE = 0.02;

/**
 * Decide whether a player enters the portal this offseason and why. Playing time
 * drives most moves: starters stay, rotation players waver, buried players leave.
 * Leaders and high-leadership players stick; low-motivation players bolt.
 * Returns the reason, or null when the player stays.
 */
export function decidePortalEntry<Position extends string, SportTraits>(
  player: Player<Position, SportTraits>,
  team: Team<Position, SportTraits>,
  input: PortalEntryDecisionInput,
): PortalReason | null {
  if (player.classYear === 'FR' || player.classYear === 'GR') return null;
  if (player.eligibility.seasonsRemaining <= 0) return null;

  const role = input.depthRank <= input.starters ? 'starter' : input.depthRank <= input.starters * 2 ? 'rotation' : 'buried';
  let chance: number = ENTRY_CHANCE[role];
  if (player.classYear === 'SR') chance *= 0.6;
  if (player.traits.includes('leader')) chance *= 0.5;
  if (player.traits.includes('low_motivation')) chance *= 1.4;
  if (player.ratings.leadership >= 75) chance *= 0.75;

  const wantsBiggerStage =
    role === 'starter' &&
    player.ratings.overall >= BIGGER_STAGE_OVERALL &&
    team.reputation.nationalPrestige < BIGGER_STAGE_PRESTIGE;
  if (wantsBiggerStage) chance += BIGGER_STAGE_CHANCE;
  const awayFromHome = player.regionId !== team.regionId;
  if (awayFromHome) chance += AWAY_FROM_HOME_CHANCE;

  if (input.random() >= chance) return null;
  if (wantsBiggerStage) return 'bigger_stage';
  if (player.isWalkOn && role !== 'starter') return 'scholarship';
  if (awayFromHome && input.random() < 0.3) return 'closer_to_home';
  return 'playing_time';
}

/** What a transfer weighs when picking a new school, shaped by why they left. */
export function portalPreferencesFor(reason: PortalReason, random: () => number): RecruitPreferences {
  const jitter = () => Math.round(random() * 30);
  const base: RecruitPreferences = {
    proximityImportance: 30 + jitter(),
    prestigeImportance: 40 + jitter(),
    scholarshipImportance: 40 + jitter(),
    playingTimeImportance: 50 + jitter(),
    academicImportance: 20 + jitter(),
  };
  switch (reason) {
    case 'playing_time':
      return { ...base, playingTimeImportance: 85 + Math.round(random() * 15) };
    case 'bigger_stage':
      return { ...base, prestigeImportance: 85 + Math.round(random() * 15) };
    case 'closer_to_home':
      return { ...base, proximityImportance: 85 + Math.round(random() * 15) };
    case 'scholarship':
      return { ...base, scholarshipImportance: 85 + Math.round(random() * 15) };
  }
}

export function createPortalEntry<Position extends string, SportTraits>(
  player: Player<Position, SportTraits>,
  team: Team<Position, SportTraits>,
  reason: PortalReason,
  season: SeasonYear,
  random: () => number,
): PortalEntry<Position, SportTraits> {
  return {
    id: `portal-${season}-${player.id}`,
    playerId: player.id,
    name: player.name,
    position: player.position,
    classYear: player.classYear,
    ratings: player.ratings,
    sportTraits: player.sportTraits,
    sourceTeamId: team.id,
    regionId: player.regionId,
    status: 'available',
    preferences: portalPreferencesFor(reason, random),
    interestByTeamId: {},
    offersByTeamId: {},
    player,
    reason,
    enteredSeason: season,
    eligibility: player.eligibility,
  };
}

export interface OpenPortalOptions<Position extends string, SportTraits> {
  season: SeasonYear;
  random: () => number;
  /** Where each player sits on the depth chart at their position (1 = first string). */
  depthRankFor: (team: Team<Position, SportTraits>, player: Player<Position, SportTraits>) => number;
  startersAt: (position: Position) => number;
}

export interface OpenPortalResult<Position extends string, SportTraits> {
  /** Rosters with the departed players removed and scholarships released. */
  teams: Team<Position, SportTraits>[];
  entries: PortalEntry<Position, SportTraits>[];
}

/**
 * Run every program's roster through the entry decision. Players who enter leave
 * their roster right away (their scholarship money is freed) and wait in the
 * portal for offers.
 */
export function openTransferPortal<Position extends string, SportTraits>(
  teams: Team<Position, SportTraits>[],
  options: OpenPortalOptions<Position, SportTraits>,
): OpenPortalResult<Position, SportTraits> {
  const entries: PortalEntry<Position, SportTraits>[] = [];
  const nextTeams = teams.map((team) => {
    const leaving = new Set<ID>();
    for (const player of team.roster) {
      const reason = decidePortalEntry(player, team, {
        depthRank: options.depthRankFor(team, player),
        starters: options.startersAt(player.position),
        random: options.random,
      });
      if (reason === null) continue;
      leaving.add(player.id);
      entries.push(createPortalEntry(player, team, reason, options.season, options.random));
    }
    if (leaving.size === 0) return team;
    const roster = team.roster.filter((p) => !leaving.has(p.id));
    return { ...team, roster, resources: { ...team.resources, scholarshipUsed: scholarshipsUsed(roster) } };
  });
  return { teams: nextTeams, entries };
}

// ── Offers ────────────────────────────────────────────────────────────────────

export function applyPortalOffer<Position extends string, SportTraits>(
  entry: PortalEntry<Position, SportTraits>,
  teamId: ID,
  scholarshipPercent: number,
): PortalEntry<Position, SportTraits> {
  const clamped = Math.min(100, Math.max(0, scholarshipPercent));
  const current = entry.interestByTeamId[teamId] ?? 0;
  const boost = Math.round(clamped * (entry.preferences.scholarshipImportance / 100) * 0.35);
  return {
    ...entry,
    offersByTeamId: { ...entry.offersByTeamId, [teamId]: clamped },
    interestByTeamId: { ...entry.interestByTeamId, [teamId]: Math.min(100, current + boost) },
  };
}

export function withdrawPortalOffer<Position extends string, SportTraits>(
  entry: PortalEntry<Position, SportTraits>,
  teamId: ID,
): PortalEntry<Position, SportTraits> {
  if (entry.offersByTeamId[teamId] === undefined) return entry;
  const offersByTeamId = { ...entry.offersByTeamId };
  delete offersByTeamId[teamId];
  const interestByTeamId = { ...entry.interestByTeamId };
  delete interestByTeamId[teamId];
  return { ...entry, offersByTeamId, interestByTeamId };
}

/** Scholarship equivalencies a team has promised to portal players still deciding. */
export function portalScholarshipsPending<Position extends string, SportTraits>(
  entries: PortalEntry<Position, SportTraits>[],
  teamId: ID,
): number {
  const total = entries.reduce((sum, entry) => {
    if (entry.status !== 'available') return sum;
    return sum + (entry.offersByTeamId[teamId] ?? 0) / 100;
  }, 0);
  return Math.round(total * 100) / 100;
}

export interface CpuPortalOfferOptions<Position extends string, SportTraits> {
  random: () => number;
  startersAt: (position: Position) => number;
  rosterLimit: number;
  /** Teams that make their own offers (the user's). */
  skipTeamIds?: ID[];
  maxOffersPerTeam?: number;
  maxOffersPerEntry?: number;
  /** Teams already holding this many at a position stop shopping there. */
  positionCapFor?: (team: Team<Position, SportTraits>, position: Position) => number;
}

export interface CpuPortalTarget<Position extends string, SportTraits> {
  entry: PortalEntry<Position, SportTraits>;
  /** How many spots up the depth chart the transfer would land vs. the current starters. */
  upgrade: number;
  scholarshipPercent: number;
}

/**
 * What a CPU program would offer from the portal: players who would start or
 * push a starter at a position it has room at, best upgrades first, within
 * its roster limit and scholarship cap.
 */
export function cpuPortalTargets<Position extends string, SportTraits>(
  team: Team<Position, SportTraits>,
  entries: PortalEntry<Position, SportTraits>[],
  options: CpuPortalOfferOptions<Position, SportTraits>,
): CpuPortalTarget<Position, SportTraits>[] {
  const targets: CpuPortalTarget<Position, SportTraits>[] = [];
  for (const entry of entries) {
    if (entry.status !== 'available' || entry.sourceTeamId === team.id) continue;
    const atPosition = team.roster
      .filter((p) => p.position === entry.position)
      .sort((a, b) => b.ratings.overall - a.ratings.overall);
    const cap = options.positionCapFor?.(team, entry.position) ?? Number.POSITIVE_INFINITY;
    if (atPosition.length >= cap) continue;
    const starters = options.startersAt(entry.position);
    // A thin position group takes anyone who beats its worst player; a full one
    // only shops for someone who would start.
    const thin = atPosition.length < starters * 2;
    const benchmark = (thin ? atPosition[atPosition.length - 1] : atPosition[starters - 1])?.ratings.overall ?? 0;
    const upgrade = entry.ratings.overall - benchmark;
    if (upgrade < 2) continue;
    // Elite transfers still expect a program near their level; weak programs
    // chase players they can realistically land.
    const prestigeGap = entry.ratings.overall - 15 - team.reputation.nationalPrestige;
    if (prestigeGap > 25) continue;
    const scholarshipPercent = entry.ratings.overall >= 72 ? 100 : entry.ratings.overall >= 62 ? 50 : 25;
    targets.push({ entry, upgrade, scholarshipPercent });
  }
  return targets.sort((a, b) => b.upgrade - a.upgrade || a.entry.id.localeCompare(b.entry.id));
}

/**
 * Every CPU program shops the portal. Teams go in a shuffled order so the same
 * few programs don't always get first crack at the best players.
 */
export function generateCpuPortalOffers<Position extends string, SportTraits>(
  entries: PortalEntry<Position, SportTraits>[],
  teams: Team<Position, SportTraits>[],
  options: CpuPortalOfferOptions<Position, SportTraits>,
): PortalEntry<Position, SportTraits>[] {
  const maxPerTeam = options.maxOffersPerTeam ?? 4;
  const maxPerEntry = options.maxOffersPerEntry ?? 2;
  const skip = new Set(options.skipTeamIds ?? []);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const offersOn = new Map<string, number>(
    entries.map((entry) => [entry.id, Object.keys(entry.offersByTeamId).length]),
  );

  for (const team of shuffle(teams, options.random)) {
    if (skip.has(team.id)) continue;
    let room = Math.max(0, options.rosterLimit - team.roster.length);
    let budget = team.resources.scholarshipLimit - team.resources.scholarshipUsed - portalScholarshipsPending([...byId.values()], team.id);
    let made = 0;
    for (const target of cpuPortalTargets(team, [...byId.values()], options)) {
      if (made >= maxPerTeam || room <= 0) break;
      const current = byId.get(target.entry.id)!;
      if ((offersOn.get(current.id) ?? 0) >= maxPerEntry) continue;
      if (current.offersByTeamId[team.id] !== undefined) continue;
      const percent = budget >= target.scholarshipPercent / 100 ? target.scholarshipPercent : budget >= 0.25 ? 25 : 0;
      byId.set(current.id, applyPortalOffer(current, team.id, percent));
      offersOn.set(current.id, (offersOn.get(current.id) ?? 0) + 1);
      budget -= percent / 100;
      room -= 1;
      made += 1;
    }
  }

  return entries.map((entry) => byId.get(entry.id) ?? entry);
}

// ── Deciding ──────────────────────────────────────────────────────────────────

export interface PortalCandidateRanking {
  teamId: ID;
  score: Rating;
  interest: Rating;
  fitScore: Rating;
  scholarshipPercent: number;
  /** Roster players at the position rated at or above the transfer. */
  playersAhead: number;
}

/** How a transfer weighs each program that offered; strongest pull first. */
export function rankPortalCandidates<Position extends string, SportTraits>(
  entry: PortalEntry<Position, SportTraits>,
  teams: Team<Position, SportTraits>[],
): PortalCandidateRanking[] {
  const prefs = entry.preferences;
  const totalWeight =
    prefs.prestigeImportance +
    prefs.proximityImportance +
    prefs.academicImportance +
    prefs.playingTimeImportance +
    prefs.scholarshipImportance;

  return teams
    .filter((team) => entry.offersByTeamId[team.id] !== undefined)
    .map((team) => {
      const interest = entry.interestByTeamId[team.id] ?? 0;
      const scholarshipPercent = entry.offersByTeamId[team.id] ?? 0;
      const playersAhead = team.roster.filter(
        (p) => p.position === entry.position && p.ratings.overall >= entry.ratings.overall,
      ).length;
      const prestigeScore = (team.reputation.nationalPrestige + team.reputation.recentSuccess) / 2;
      const proximityScore = entry.regionId === team.regionId ? 100 : 30;
      const playingTimeScore = clamp(100 - playersAhead * 30, 10, 100);
      const fitScore =
        totalWeight > 0
          ? Math.round(
              (prestigeScore * prefs.prestigeImportance +
                proximityScore * prefs.proximityImportance +
                team.reputation.academicPrestige * prefs.academicImportance +
                playingTimeScore * prefs.playingTimeImportance +
                scholarshipPercent * prefs.scholarshipImportance) /
                totalWeight,
            )
          : 50;
      return {
        teamId: team.id,
        score: Math.round(interest * 0.4 + fitScore * 0.6),
        interest,
        fitScore,
        scholarshipPercent,
        playersAhead,
      };
    })
    .sort((a, b) => b.score - a.score || b.scholarshipPercent - a.scholarshipPercent || a.teamId.localeCompare(b.teamId));
}

export function resolvePortalCommitments<Position extends string, SportTraits>(
  entries: PortalEntry<Position, SportTraits>[],
  teams: Team<Position, SportTraits>[],
): PortalEntry<Position, SportTraits>[] {
  return entries.map((entry) => {
    if (entry.status !== 'available') return entry;
    const best = rankPortalCandidates(entry, teams)[0];
    if (!best || best.score < 15) return { ...entry, status: 'withdrawn' as const };
    return { ...entry, status: 'committed' as const, committedTeamId: best.teamId };
  });
}

// ── Moving players ────────────────────────────────────────────────────────────

export type PortalOutcome = 'transferred' | 'returned' | 'left_division';

export interface PortalMove {
  entryId: string;
  outcome: PortalOutcome;
  playerId: ID;
  name: PersonName;
  position: string;
  classYear: PlayerClass;
  overall: Rating;
  fromTeamId: ID;
  /** Only set for a transfer; a returned or departed player has no new program here. */
  toTeamId?: ID;
}

export interface ApplyPortalResult<Position extends string, SportTraits> {
  teams: Team<Position, SportTraits>[];
  moves: PortalMove[];
}

/**
 * Put resolved portal players on rosters: commits join their new program on the
 * scholarship they were offered, and withdrawals go back where they came from.
 */
export function applyPortalResolution<Position extends string, SportTraits>(
  teams: Team<Position, SportTraits>[],
  entries: PortalEntry<Position, SportTraits>[],
  season: SeasonYear,
): ApplyPortalResult<Position, SportTraits> {
  const arrivals = new Map<ID, Player<Position, SportTraits>[]>();
  const moves: PortalMove[] = [];
  const add = (teamId: ID, player: Player<Position, SportTraits>) => {
    arrivals.set(teamId, [...(arrivals.get(teamId) ?? []), player]);
  };

  for (const entry of entries) {
    if (entry.status === 'available') continue;
    const move = {
      entryId: entry.id,
      playerId: entry.playerId,
      name: entry.name,
      position: entry.position,
      classYear: entry.classYear,
      overall: entry.ratings.overall,
      fromTeamId: entry.sourceTeamId,
    };
    if (entry.status === 'committed' && entry.committedTeamId !== undefined) {
      const scholarshipPercent = entry.offersByTeamId[entry.committedTeamId] ?? 0;
      add(entry.committedTeamId, {
        ...entry.player,
        scholarshipPercent,
        isWalkOn: scholarshipPercent === 0,
        morale: 75,
        transfers: [...(entry.player.transfers ?? []), { season, fromTeamId: entry.sourceTeamId, toTeamId: entry.committedTeamId }],
      });
      moves.push({ ...move, outcome: 'transferred', toTeamId: entry.committedTeamId });
    } else if (entry.player.isWalkOn) {
      // A walk-on who found no scholarship offers takes one at a smaller school.
      moves.push({ ...move, outcome: 'left_division' });
    } else {
      add(entry.sourceTeamId, { ...entry.player, morale: 40 });
      moves.push({ ...move, outcome: 'returned' });
    }
  }

  const nextTeams = teams.map((team) => {
    const incoming = arrivals.get(team.id);
    if (!incoming || incoming.length === 0) return team;
    const existing = new Set(team.roster.map((p) => p.id));
    const roster = [...team.roster, ...incoming.filter((p) => !existing.has(p.id))];
    return { ...team, roster, resources: { ...team.resources, scholarshipUsed: scholarshipsUsed(roster) } };
  });

  return { teams: nextTeams, moves };
}

function scholarshipsUsed<Position extends string, SportTraits>(roster: Player<Position, SportTraits>[]): number {
  return Math.round(roster.reduce((sum, p) => sum + p.scholarshipPercent / 100, 0) * 100) / 100;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
