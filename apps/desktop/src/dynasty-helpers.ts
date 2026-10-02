import {
  addSignedRecruitsToTeam,
  applyScholarshipOffer,
  chooseCommitTeam,
  commitRecruit,
  recruitDecisionWeek,
  recruitPrestigeMultiplier,
  portalScholarshipsPending,
  evolveProgramPrestige,
  runTeamOffseason,
  shouldReopenCommitment,
  signCommittedRecruit,
  sortRecruitBoardForTeam,
} from '@sports-management-sim/engine-core';
import type { PortalMove, PortalReason, StandingsEntry } from '@sports-management-sim/engine-core';
import {
  createLacrosseSeasonSchedule,
  generateLacrosseRecruitingClass,
  generateLacrosseWalkOns,
  recruitingClassSize,
  developmentBonusFor,
  programStaffRating,
  rollLacrosseInjuries,
  openLacrossePortal,
  generateLacrosseCpuPortalOffers,
  resolveLacrossePortal,
} from '@sports-management-sim/sport-lacrosse';
import type {
  LacrossePlayer,
  LacrossePortalEntry,
  LacrosseDynastyState,
  LacrosseRecruit,
  LacrosseSeason,
  LacrosseStaff,
  LacrosseTeam,
} from '@sports-management-sim/sport-lacrosse';
import { computeSeasonAwards } from './awards';
import type { SeasonAwards } from './awards';
import type { SeasonStatsMap } from './stats';
import { capturePreOffseasonSnapshot, computeDevelopmentReport } from './development-report';
import type { DevelopmentReport } from './development-report';

export type { DevelopmentReport };

export type TrainingFocus = 'balanced' | 'offense' | 'defense' | 'goalies' | 'faceoffs';

export const TRAINING_FOCUS_LABELS: Record<TrainingFocus, { label: string; hint: string }> = {
  balanced: { label: 'Balanced', hint: 'Even development across the roster' },
  offense: { label: 'Offense', hint: 'Extra reps for attackmen and midfielders' },
  defense: { label: 'Defense', hint: 'Extra reps for close defense and LSMs' },
  goalies: { label: 'Goalies', hint: 'Extra reps for the goalie room' },
  faceoffs: { label: 'Faceoffs', hint: 'Extra reps for FOGOs' },
};

const TRAINING_FOCUS_POSITIONS: Record<Exclude<TrainingFocus, 'balanced'>, readonly string[]> = {
  offense: ['ATT', 'MID'],
  defense: ['DEF', 'LSM'],
  goalies: ['GK'],
  faceoffs: ['FOGO'],
};

const TRAINING_FOCUS_BONUS = 0.25;

export interface SigningDayFlip {
  name: string;
  position: string;
  starRating: number;
  fromTeamName: string;
  toTeamName: string;
}

export interface OffseasonSummary {
  seasonYear: number;
  finalStandings: StandingsEntry[];
  userStanding: number;
  userRecord: { wins: number; losses: number };
  graduates: { name: string; position: string; overall: number }[];
  developmentReport: DevelopmentReport | null;
  signingClass: { name: string; position: string; starRating: number; overall: number }[];
  /** Commitments that flipped to a rival school on signing day. */
  signingDayFlips?: SigningDayFlip[];
  awards: SeasonAwards | null;
  /** The user's players who put their name in the transfer portal. */
  portalDepartures?: PortalDeparture[];
}

export interface PortalDeparture {
  entryId: string;
  name: string;
  position: string;
  classYear: string;
  overall: number;
  reason: PortalReason;
}

export interface InjuredPlayer {
  playerId: string;
  teamId: string;
  weeksRemaining: number;
  /** e.g. "ankle sprain"; missing on saves from before injury types. */
  description?: string;
}

export interface NewInjury {
  playerId: string;
  teamId: string;
  playerName: string;
  weeksRemaining: number;
  description: string;
}

/**
 * Advance existing injuries a week and roll new ones. Injury risk comes from
 * the engine (rollLacrosseInjuries) and follows time on the field, so teams
 * listed in `playedTeamIds` face game risk and everyone else only practice risk.
 * Omit `playedTeamIds` to treat every team as having played.
 */
export function processInjuries(
  currentInjuries: InjuredPlayer[],
  teams: LacrosseTeam[],
  random: () => number,
  playedTeamIds?: Set<string>,
): {
  injuries: InjuredPlayer[];
  newlyInjured: NewInjury[];
  recovered: { playerId: string; teamId: string; playerName: string }[];
} {
  const decremented = currentInjuries.map((inj) => ({
    ...inj,
    weeksRemaining: inj.weeksRemaining - 1,
  }));

  const recovered: { playerId: string; teamId: string; playerName: string }[] = [];
  const stillActive: InjuredPlayer[] = [];

  for (const inj of decremented) {
    if (inj.weeksRemaining <= 0) {
      const player = teams.find((t) => t.id === inj.teamId)?.roster.find((p) => p.id === inj.playerId);
      recovered.push({
        playerId: inj.playerId,
        teamId: inj.teamId,
        playerName: player ? `${player.name.first} ${player.name.last}` : 'Unknown Player',
      });
    } else {
      stillActive.push(inj);
    }
  }

  // Anyone hurt going into this week sat out, so they weren't on the field to get hurt again.
  const injuredIds = new Set(currentInjuries.map((inj) => inj.playerId));
  const newlyInjured: NewInjury[] = [];

  for (const team of teams) {
    const healthy = { ...team, roster: team.roster.filter((p) => !injuredIds.has(p.id)) };
    const played = playedTeamIds ? playedTeamIds.has(team.id) : true;
    for (const injury of rollLacrosseInjuries(healthy, { played, random })) {
      const player = team.roster.find((p) => p.id === injury.playerId)!;
      newlyInjured.push({
        playerId: injury.playerId,
        teamId: team.id,
        playerName: `${player.name.first} ${player.name.last}`,
        weeksRemaining: injury.weeksOut,
        description: injury.description,
      });
    }
  }

  return {
    injuries: [
      ...stillActive,
      ...newlyInjured.map(({ playerId, teamId, weeksRemaining, description }) => ({ playerId, teamId, weeksRemaining, description })),
    ],
    newlyInjured,
    recovered,
  };
}

/**
 * A postseason weekend passes: everyone on the injury list heals a week and
 * anyone whose time is up returns. Nobody gets hurt in the postseason sim, so
 * this is the only way the list changes between the regular season and the offseason.
 */
export function healInjuriesOneWeek(currentInjuries: InjuredPlayer[]): InjuredPlayer[] {
  return currentInjuries
    .map((inj) => ({ ...inj, weeksRemaining: inj.weeksRemaining - 1 }))
    .filter((inj) => inj.weeksRemaining > 0);
}

/** A recruit shuts down their recruitment early only when one school is a runaway leader. */
const EARLY_COMMIT_INTEREST = 95;
const EARLY_COMMIT_LEAD = 20;

export function autoCommitWeekly(
  recruits: LacrosseRecruit[],
  teams: LacrosseTeam[],
  userTeamId: string,
  currentWeek: number,
  random: () => number,
  finalWeek = 10,
): LacrosseRecruit[] {
  // CPU teams gradually extend offers week by week
  const updated = applyCpuWeeklyOffers(recruits, teams, userTeamId, random);

  return updated.map((recruit) => {
    // Committed-but-unsigned recruits can reopen when a rival (usually a user
    // running flip pitches) has clearly overtaken their school.
    if (recruit.status === 'committed' && recruit.committedTeamId !== undefined) {
      if (shouldReopenCommitment(recruit, random)) {
        const formerTeamId = recruit.committedTeamId;
        const { committedTeamId: _dropped, ...reopened } = recruit;
        return {
          ...reopened,
          status: 'open' as const,
          interestByTeamId: {
            ...recruit.interestByTeamId,
            [formerTeamId]: Math.max(0, (recruit.interestByTeamId[formerTeamId] ?? 0) - 20),
          },
        };
      }
      return recruit;
    }
    if (recruit.status !== 'open') return recruit;
    if (recruit.scholarshipOffers.length === 0) return recruit;

    const updatedInterest = { ...recruit.interestByTeamId };

    // Passive weekly drift. Deliberately small for the user's program: sustained
    // gains come from spending recruiting hours on pitches and visits.
    for (const offer of recruit.scholarshipOffers) {
      const team = teams.find((t) => t.id === offer.teamId);
      if (!team) continue;
      const current = updatedInterest[team.id] ?? 0;
      const prestigeMult = recruitPrestigeMultiplier(recruit.starRating, team.reputation.nationalPrestige);
      if (team.id === userTeamId) {
        const scholarshipPull = (offer.scholarshipPercent / 100) * (recruit.preferences.scholarshipImportance / 100) * 3;
        const gain = Math.round((3 + recruit.starRating * 0.5 + scholarshipPull) * prestigeMult);
        updatedInterest[team.id] = Math.min(100, current + gain);
      } else {
        // CPU staffs work their boards off-screen, so their drift stays stronger.
        const prestigeBonus = (team.reputation.nationalPrestige / 100) * 4;
        const gain = Math.round((5 + recruit.starRating * 0.5 + prestigeBonus + random() * 3) * prestigeMult);
        updatedInterest[team.id] = Math.min(100, current + gain);
      }
    }

    const withInterest = { ...recruit, interestByTeamId: updatedInterest };

    // Recruits announce on their own schedule; a runaway leader can end it early.
    const ranked = recruit.scholarshipOffers
      .map((o) => ({ teamId: o.teamId, interest: updatedInterest[o.teamId] ?? 0 }))
      .sort((a, b) => b.interest - a.interest);
    const leader = ranked[0];
    const runnerUp = ranked[1];
    const runawayLeader =
      leader !== undefined &&
      leader.interest >= EARLY_COMMIT_INTEREST &&
      leader.interest - (runnerUp?.interest ?? 0) >= EARLY_COMMIT_LEAD;
    const decisionWeek = recruitDecisionWeek(recruit.id, recruit.starRating, finalWeek);

    if (runawayLeader) {
      return { ...withInterest, status: 'committed' as const, committedTeamId: leader.teamId };
    }
    if (currentWeek >= decisionWeek) {
      const committingTo = chooseCommitTeam(withInterest, teams, random);
      if (committingTo !== undefined) {
        return { ...withInterest, status: 'committed' as const, committedTeamId: committingTo };
      }
    }

    return withInterest;
  });
}

/**
 * How much a CPU program puts on the table. Elite programs spend real money on
 * blue-chips; everyone throws depth money at the back of the board.
 */
function cpuOfferPercent(starRating: number, nationalPrestige: number): number {
  if (starRating >= 5) return nationalPrestige >= 70 ? 100 : nationalPrestige >= 55 ? 75 : 50;
  if (starRating === 4) return nationalPrestige >= 70 ? 75 : 50;
  if (starRating === 3) return 50;
  return 25;
}

/** An offer slot is only tied up while the recruit is still winnable. */
function cpuActiveOfferIds(recruits: LacrosseRecruit[], teamId: string): Set<string> {
  return new Set(
    recruits
      .filter((r) => r.scholarshipOffers.some((o) => o.teamId === teamId))
      .filter((r) => r.status === 'open' || r.committedTeamId === teamId || r.signedTeamId === teamId)
      .map((r) => r.id),
  );
}

/**
 * Recruit to your level: a CPU board is the shared national board rescaled by
 * how attainable each recruit is for this program, so bottom-prestige teams
 * chase 2-3★ depth they can actually land instead of the same Top 100 as
 * everyone else.
 */
function cpuBoardForTeam(
  team: LacrosseTeam,
  candidates: LacrosseRecruit[],
  rosterTargets: Record<string, number>,
): LacrosseRecruit[] {
  return sortRecruitBoardForTeam(team, candidates, rosterTargets)
    .map((entry) => ({
      recruit: entry.recruit,
      score: entry.score * recruitPrestigeMultiplier(entry.recruit.starRating, team.reputation.nationalPrestige),
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.recruit);
}

const CPU_ROSTER_TARGETS = { ATT: 8, MID: 16, DEF: 10, GK: 4, FOGO: 3, LSM: 4 } as const;
const ROSTER_CAP = 45;
/** NCAA men's lacrosse roster limit; CPU programs never sign past it. */
export const ROSTER_LIMIT = 48;

/** Next fall's roster if every current pledge signs: leavers out, commits in. */
function projectedRosterSize(team: LacrosseTeam, recruits: LacrosseRecruit[]): number {
  const graduating = team.roster.filter((p) => p.classYear === 'SR' || p.classYear === 'GR').length;
  const pledged = recruits.filter(
    (r) => r.committedTeamId === team.id || r.signedTeamId === team.id,
  ).length;
  return team.roster.length - graduating + pledged;
}

function applyCpuWeeklyOffers(
  recruits: LacrosseRecruit[],
  teams: LacrosseTeam[],
  userTeamId: string,
  _random: () => number,
): LacrosseRecruit[] {
  const CPU_MAX_OFFERS = 12;
  const CPU_WEEKLY_NEW_OFFERS = 2;

  const updated = [...recruits];

  for (const team of teams) {
    if (team.id === userTeamId) continue;

    // Offers to recruits lost to rivals release their slot, like the user's
    // scholarship budget releasing money when a target signs elsewhere.
    const activeOfferIds = cpuActiveOfferIds(updated, team.id);
    if (activeOfferIds.size >= CPU_MAX_OFFERS) continue;
    if (projectedRosterSize(team, updated) >= ROSTER_CAP) continue;

    const everOfferedIds = new Set(
      updated.filter((r) => r.scholarshipOffers.some((o) => o.teamId === team.id)).map((r) => r.id),
    );
    const canOffer = Math.min(CPU_WEEKLY_NEW_OFFERS, CPU_MAX_OFFERS - activeOfferIds.size);
    const open = updated.filter((r) => r.status === 'open' && !everOfferedIds.has(r.id));
    const board = cpuBoardForTeam(team, open, CPU_ROSTER_TARGETS);

    let count = 0;
    for (const recruit of board) {
      if (count >= canOffer) break;
      const idx = updated.findIndex((r) => r.id === recruit.id);
      if (idx >= 0) {
        updated[idx] = applyScholarshipOffer(
          updated[idx]!,
          team.id,
          cpuOfferPercent(recruit.starRating, team.reputation.nationalPrestige),
        );
        count++;
      }
    }
  }

  return updated;
}

export function runOffseason(
  dynasty: LacrosseDynastyState,
  nationalChampionId?: string,
  trainingFocus: TrainingFocus = 'balanced',
  seasonStats?: SeasonStatsMap,
  userStaff?: LacrosseStaff,
): { newDynasty: LacrosseDynastyState; summary: OffseasonSummary } {
  const { season, recruits, userTeamId, seed, rosterTargets } = dynasty;
  const newYear = season.year + 1;

  const userTeam = season.teams.find((t) => t.id === userTeamId)!;
  const sortedStandings = [...season.standings].sort(
    (a, b) => b.record.wins - a.record.wins || a.record.losses - b.record.losses,
  );
  const userStanding = sortedStandings.findIndex((s) => s.teamId === userTeamId) + 1;

  // Snapshot ratings before the offseason mutates them
  const preOffseasonSnapshot = capturePreOffseasonSnapshot(userTeam);

  const graduates = userTeam.roster
    .filter((p) => p.classYear === 'SR' || p.classYear === 'GR')
    .map((p) => ({
      name: `${p.name.first} ${p.name.last}`,
      position: p.position,
      overall: p.ratings.overall,
    }));

  // CPU teams make offers to their top targets before signing day
  const withCpuOffers = applyeCpuOffers(recruits, season.teams, userTeamId);

  // Signing day: open recruits who hold offers pick among the programs that
  // still have room under the NCAA's 48-man roster limit.
  const fullyCommitted = [...withCpuOffers];
  for (let i = 0; i < fullyCommitted.length; i += 1) {
    const r = fullyCommitted[i]!;
    if (r.status !== 'open' || r.scholarshipOffers.length === 0) continue;
    const withRoom = season.teams.filter(
      (t) => t.id === userTeamId || projectedRosterSize(t, fullyCommitted) < ROSTER_LIMIT,
    );
    fullyCommitted[i] = commitRecruit(r, withRoom);
  }

  // Signing-day drama: a school that kept working a committed recruit and clearly
  // overtook their pledge steals the signature at the last moment.
  const signingDayFlips: SigningDayFlip[] = [];
  const teamNameById = new Map(season.teams.map((t) => [t.id, t.name]));
  const afterFlips = fullyCommitted.map((r) => {
    if (r.status !== 'committed' || r.committedTeamId === undefined) return r;
    const committedInterest = r.interestByTeamId[r.committedTeamId] ?? 0;
    const rival = r.scholarshipOffers
      .filter((o) => o.teamId !== r.committedTeamId)
      .map((o) => ({ teamId: o.teamId, interest: r.interestByTeamId[o.teamId] ?? 0 }))
      .sort((a, b) => b.interest - a.interest)[0];
    if (rival === undefined || rival.interest <= committedInterest + 12) return r;
    const involvesUser = r.committedTeamId === userTeamId || rival.teamId === userTeamId;
    if (involvesUser) {
      signingDayFlips.push({
        name: `${r.name.first} ${r.name.last}`,
        position: r.position,
        starRating: r.starRating,
        fromTeamName: teamNameById.get(r.committedTeamId) ?? r.committedTeamId,
        toTeamName: teamNameById.get(rival.teamId) ?? rival.teamId,
      });
    }
    return { ...r, committedTeamId: rival.teamId };
  });

  // Sign all committed recruits
  const signed = afterFlips.map((r) =>
    r.status === 'committed' ? signCommittedRecruit(r) : r,
  );

  // Evolve program prestige based on season performance
  const teamsWithPrestige = evolveProgramPrestige(season.teams, sortedStandings, nationalChampionId);

  // Run offseason for returning players first (advances class years, graduates seniors),
  // then add the signing class as true freshmen for the upcoming season.
  const focusPositions = trainingFocus !== 'balanced' ? TRAINING_FOCUS_POSITIONS[trainingFocus] : null;
  const staffOwner = { teamId: userTeamId, ...(userStaff ? { staff: userStaff } : {}) };
  const teamsAfterOffseason = teamsWithPrestige.map((team) => {
    // The development coordinator lifts every player; the training focus adds
    // a bigger push for the chosen position group.
    const staffBonus = developmentBonusFor(programStaffRating(team, 'development', staffOwner));
    const userFocus = team.id === userTeamId ? focusPositions : null;
    const afterOffseason = runTeamOffseason(team, {
      completedSeason: season.year,
      developmentBonusFor: (player) =>
        staffBonus + (userFocus?.includes(player.position) ? TRAINING_FOCUS_BONUS : 0),
    });
    const withClass = addSignedRecruitsToTeam(afterOffseason, signed, newYear);
    const withWalkOns = backfillWalkOns(withClass, rosterTargets, seed + newYear, newYear);
    const trimmed = team.id === userTeamId ? withWalkOns : enforceRosterLimit(withWalkOns);
    return pruneDepthChart(trimmed);
  });

  // The portal opens on the new rosters: the depth chart decides who leaves,
  // and every CPU program makes its offers before the user sees the board.
  const newSeed = seed + newYear;
  const portal = openLacrossePortal(teamsAfterOffseason, { seed: newSeed, season: newYear });
  const portalEntries = generateLacrosseCpuPortalOffers(portal.entries, portal.teams, { seed: newSeed, userTeamId });
  const teamsForNewSeason = portal.teams;
  const portalDepartures: PortalDeparture[] = portalEntries
    .filter((e) => e.sourceTeamId === userTeamId)
    .map((e) => ({
      entryId: e.id,
      name: `${e.name.first} ${e.name.last}`,
      position: e.position,
      classYear: e.classYear,
      overall: e.ratings.overall,
      reason: e.reason,
    }));

  // Capture user team signing class for summary
  const signingClass = signed
    .filter((r) => r.signedTeamId === userTeamId)
    .map((r) => ({
      name: `${r.name.first} ${r.name.last}`,
      position: r.position,
      starRating: r.starRating,
      overall: r.ratings.overall,
    }));

  // Compute season awards (stat-based when season stats are available)
  const awards = computeSeasonAwards(season, userTeamId, seasonStats);

  // Compute development report (compare post-offseason ratings vs pre-offseason snapshot)
  const postOffseasonUserTeam = teamsAfterOffseason.find((t) => t.id === userTeamId);
  const developmentReport = postOffseasonUserTeam
    ? computeDevelopmentReport(postOffseasonUserTeam, preOffseasonSnapshot)
    : null;

  // Generate new recruiting class and board
  const newRecruits = generateLacrosseRecruitingClass({
    count: recruitingClassSize(teamsForNewSeason.length),
    seed: newSeed,
  });
  const newUserTeam = teamsForNewSeason.find((t) => t.id === userTeamId)!;
  const newRecruitBoard = sortRecruitBoardForTeam(newUserTeam, newRecruits, rosterTargets);

  const newSeason: LacrosseSeason = {
    ...season,
    year: newYear,
    teams: teamsForNewSeason,
    schedule: createLacrosseSeasonSchedule(newYear, season.conferences),
    standings: [],
    currentWeek: 1,
    phase: 'regular_season',
  };

  const summary: OffseasonSummary = {
    seasonYear: season.year,
    finalStandings: sortedStandings,
    userStanding,
    userRecord: { wins: userTeam.record.wins, losses: userTeam.record.losses },
    graduates,
    signingClass,
    signingDayFlips,
    awards,
    developmentReport,
    portalDepartures,
  };

  return {
    newDynasty: {
      ...dynasty,
      season: newSeason,
      recruits: newRecruits,
      recruitBoard: newRecruitBoard,
      seed: newSeed,
      portalEntries,
    },
    summary,
  };
}

export interface PortalResolution {
  dynasty: LacrosseDynastyState;
  moves: PortalMove[];
}

/**
 * Season start: every transfer still in the portal picks a school. Commits join
 * their new roster, scholarship players nobody wanted go back home, and CPU
 * programs that took on too many make cuts.
 */
export function resolveAndApplyPortal(dynasty: LacrosseDynastyState): PortalResolution {
  const year = dynasty.season.year;
  const resolved = resolveLacrossePortal(dynasty.portalEntries, dynasty.season.teams, year);
  // Programs the portal drained fill out with walk-ons; CPU programs that
  // took on too many make cuts.
  const teams = resolved.teams.map((team) => {
    const filled = backfillWalkOns(team, dynasty.rosterTargets, dynasty.seed + year + 1, year);
    return pruneDepthChart(team.id === dynasty.userTeamId ? filled : enforceRosterLimit(filled));
  });
  return {
    dynasty: {
      ...dynasty,
      season: { ...dynasty.season, teams },
      portalEntries: resolved.entries,
    },
    moves: resolved.moves,
  };
}

/** Scholarship equivalencies the user can still promise to portal players. */
export function portalScholarshipRoom(team: LacrosseTeam, entries: LacrossePortalEntry[]): number {
  const room = team.resources.scholarshipLimit - team.resources.scholarshipUsed - portalScholarshipsPending(entries, team.id);
  return Math.max(0, Math.round(room * 100) / 100);
}

/** Never cut a team below this many at a position. */
const POSITION_MINIMUMS: Partial<Record<LacrossePlayer['position'], number>> = { GK: 2, FOGO: 1 };

/**
 * CPU programs over the roster limit (in-season commits and signing-day flips
 * can land a few extra) make preseason cuts: walk-ons first, then the
 * lowest-rated players, never below the position minimums.
 */
export function enforceRosterLimit(team: LacrosseTeam, limit = ROSTER_LIMIT): LacrosseTeam {
  const excess = team.roster.length - limit;
  if (excess <= 0) return team;
  const counts = new Map<string, number>();
  for (const p of team.roster) counts.set(p.position, (counts.get(p.position) ?? 0) + 1);
  const candidates = [...team.roster].sort(
    (a, b) => Number(b.isWalkOn) - Number(a.isWalkOn) || a.ratings.overall - b.ratings.overall,
  );
  const cut = new Set<string>();
  for (const player of candidates) {
    if (cut.size >= excess) break;
    const left = counts.get(player.position) ?? 0;
    if (left <= (POSITION_MINIMUMS[player.position] ?? 0)) continue;
    counts.set(player.position, left - 1);
    cut.add(player.id);
  }
  return { ...team, roster: team.roster.filter((p) => !cut.has(p.id)) };
}

/** No program fields fewer players than this — walk-on tryouts fill the gap. */
export const ROSTER_FLOOR = 38;

/**
 * Backfill thin rosters with freshman walk-ons after signing day. Positions are
 * chosen by need: anything at zero (a roster with no goalie can't play) first,
 * then the largest relative deficit against roster targets.
 */
function backfillWalkOns(
  team: LacrosseTeam,
  rosterTargets: Record<string, number>,
  seed: number,
  seasonYear: number,
): LacrosseTeam {
  if (team.roster.length >= ROSTER_FLOOR) return team;

  const targetEntries = Object.entries(rosterTargets) as Array<[LacrossePlayer['position'], number]>;
  const counts = new Map<string, number>();
  for (const player of team.roster) {
    counts.set(player.position, (counts.get(player.position) ?? 0) + 1);
  }

  const positions: LacrossePlayer['position'][] = [];
  while (team.roster.length + positions.length < ROSTER_FLOOR) {
    let best: LacrossePlayer['position'] | null = null;
    let bestScore = -Infinity;
    for (const [position, target] of targetEntries) {
      if (target <= 0) continue;
      const current = counts.get(position) ?? 0;
      const score = (current === 0 ? 100 : 0) + (target - current) / target;
      if (score > bestScore) {
        bestScore = score;
        best = position;
      }
    }
    const chosen = best ?? 'MID';
    positions.push(chosen);
    counts.set(chosen, (counts.get(chosen) ?? 0) + 1);
  }

  const walkOns = generateLacrosseWalkOns({
    seed: seed + hashString(team.id),
    createdSeason: seasonYear,
    positions,
  });

  return { ...team, roster: [...team.roster, ...walkOns] };
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pruneDepthChart(team: LacrosseTeam): LacrosseTeam {
  const dc = (team as LacrosseTeam & { depthChart?: Record<string, string[]> }).depthChart;
  if (!dc) return team;
  const rosterIds = new Set(team.roster.map((p) => p.id));
  return {
    ...team,
    depthChart: Object.fromEntries(
      Object.entries(dc).map(([pos, ids]) => [pos, ids.filter((id) => rosterIds.has(id))]),
    ),
  } as LacrosseTeam;
}

// Signing-day sweep: each CPU team offers its top 15 remaining open recruits,
// ranked by attainability and priced by prestige and star level.
function applyeCpuOffers(
  recruits: LacrosseRecruit[],
  teams: LacrosseTeam[],
  userTeamId: string,
): LacrosseRecruit[] {
  const updated = [...recruits];

  for (const team of teams) {
    if (team.id === userTeamId) continue;
    const room = ROSTER_CAP - projectedRosterSize(team, updated);
    if (room <= 0) continue;
    const openRecruits = updated.filter((r) => r.status === 'open');
    const board = cpuBoardForTeam(team, openRecruits, CPU_ROSTER_TARGETS);
    for (const recruit of board.slice(0, Math.min(15, room))) {
      const idx = updated.findIndex((r) => r.id === recruit.id);
      if (idx >= 0) {
        updated[idx] = applyScholarshipOffer(
          updated[idx]!,
          team.id,
          cpuOfferPercent(recruit.starRating, team.reputation.nationalPrestige),
        );
      }
    }
  }

  return updated;
}
