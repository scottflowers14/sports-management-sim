import {
  addSignedRecruitsToTeam,
  applyScholarshipOffer,
  chooseCommitTeam,
  commitRecruit,
  recruitDecisionWeek,
  recruitPrestigeMultiplier,
  resolvePortalCommitments,
  runTeamOffseason,
  shouldReopenCommitment,
  signCommittedRecruit,
  sortRecruitBoardForTeam,
} from '@sports-management-sim/engine-core';
import type { EligibilityStatus, PlayerClass, StandingsEntry } from '@sports-management-sim/engine-core';
import { createLacrosseSeasonSchedule, generateLacrosseRecruitingClass, recruitingClassSize } from '@sports-management-sim/sport-lacrosse';
import type {
  LacrossePlayer,
  LacrossePlayerTraits,
  LacrossePortalEntry,
  LacrosseDynastyState,
  LacrosseRecruit,
  LacrosseSeason,
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
}

export interface InjuredPlayer {
  playerId: string;
  teamId: string;
  weeksRemaining: number;
}

export function processInjuries(
  currentInjuries: InjuredPlayer[],
  teams: LacrosseTeam[],
  random: () => number,
  injuryChance = 0.03,
): {
  injuries: InjuredPlayer[];
  newlyInjured: { playerId: string; teamId: string; playerName: string; weeksRemaining: number }[];
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

  const injuredIds = new Set(stillActive.map((inj) => inj.playerId));
  const newlyInjured: { playerId: string; teamId: string; playerName: string; weeksRemaining: number }[] = [];
  const newEntries: InjuredPlayer[] = [];

  for (const team of teams) {
    for (const player of team.roster) {
      if (injuredIds.has(player.id)) continue;
      if (random() < injuryChance) {
        const weeksRemaining = 1 + Math.floor(random() * 4);
        newlyInjured.push({
          playerId: player.id,
          teamId: team.id,
          playerName: `${player.name.first} ${player.name.last}`,
          weeksRemaining,
        });
        newEntries.push({ playerId: player.id, teamId: team.id, weeksRemaining });
      }
    }
  }

  return {
    injuries: [...stillActive, ...newEntries],
    newlyInjured,
    recovered,
  };
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

function applyCpuWeeklyOffers(
  recruits: LacrosseRecruit[],
  teams: LacrosseTeam[],
  userTeamId: string,
  _random: () => number,
): LacrosseRecruit[] {
  const CPU_MAX_OFFERS = 12;
  const CPU_WEEKLY_NEW_OFFERS = 2;
  const rosterTargets = { ATT: 8, MID: 16, DEF: 10, GK: 4, FOGO: 3, LSM: 4 } as const;

  const updated = [...recruits];

  for (const team of teams) {
    if (team.id === userTeamId) continue;

    const alreadyOfferedIds = new Set(
      updated.filter((r) => r.scholarshipOffers.some((o) => o.teamId === team.id)).map((r) => r.id),
    );

    if (alreadyOfferedIds.size >= CPU_MAX_OFFERS) continue;

    const canOffer = Math.min(CPU_WEEKLY_NEW_OFFERS, CPU_MAX_OFFERS - alreadyOfferedIds.size);
    const open = updated.filter((r) => r.status === 'open' && !alreadyOfferedIds.has(r.id));
    const board = sortRecruitBoardForTeam(team, open, rosterTargets);

    let count = 0;
    for (const entry of board) {
      if (count >= canOffer) break;
      const idx = updated.findIndex((r) => r.id === entry.recruit.id);
      if (idx >= 0) {
        updated[idx] = applyScholarshipOffer(updated[idx]!, team.id, 50);
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

  // Commit remaining open recruits who have an offer
  const fullyCommitted = withCpuOffers.map((r) =>
    r.status === 'open' && r.scholarshipOffers.length > 0
      ? commitRecruit(r, season.teams)
      : r,
  );

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
  const teamsWithPrestige = evolvePrestige(season.teams, sortedStandings, nationalChampionId);

  // Run offseason for returning players first (advances class years, graduates seniors),
  // then add the signing class as true freshmen for the upcoming season.
  const focusPositions = trainingFocus !== 'balanced' ? TRAINING_FOCUS_POSITIONS[trainingFocus] : null;
  const teamsAfterOffseason = teamsWithPrestige.map((team) => {
    const afterOffseason =
      team.id === userTeamId && focusPositions
        ? runTeamOffseason(team, {
            developmentBonusFor: (player) => (focusPositions.includes(player.position) ? TRAINING_FOCUS_BONUS : 0),
          })
        : runTeamOffseason(team);
    const withClass = addSignedRecruitsToTeam(afterOffseason, signed, newYear);
    return pruneDepthChart(withClass);
  });

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
  const newSeed = seed + newYear;
  const newRecruits = generateLacrosseRecruitingClass({
    count: recruitingClassSize(teamsAfterOffseason.length),
    seed: newSeed,
  });
  const newUserTeam = teamsAfterOffseason.find((t) => t.id === userTeamId)!;
  const newRecruitBoard = sortRecruitBoardForTeam(newUserTeam, newRecruits, rosterTargets);

  const newSeason: LacrosseSeason = {
    ...season,
    year: newYear,
    teams: teamsAfterOffseason,
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
  };

  return {
    newDynasty: {
      ...dynasty,
      season: newSeason,
      recruits: newRecruits,
      recruitBoard: newRecruitBoard,
      seed: newSeed,
      portalEntries: generatePortalEntries(teamsAfterOffseason, userTeamId, newSeed),
    },
    summary,
  };
}

export function resolveAndApplyPortal(dynasty: LacrosseDynastyState): LacrosseDynastyState {
  const resolved = resolvePortalCommitments(dynasty.portalEntries, dynasty.season.teams);

  // All portal entries represent players who have left their source program
  const removedIdsByTeam = new Map<string, Set<string>>();
  for (const entry of resolved) {
    const ids = removedIdsByTeam.get(entry.sourceTeamId) ?? new Set<string>();
    ids.add(entry.playerId);
    removedIdsByTeam.set(entry.sourceTeamId, ids);
  }

  // Remove portal players from source rosters
  let updatedTeams = dynasty.season.teams.map((team) => {
    const removedIds = removedIdsByTeam.get(team.id);
    if (!removedIds) return team;
    return { ...team, roster: team.roster.filter((p) => !removedIds.has(p.id)) };
  });

  // Add players who committed to the user team
  const userCommits = resolved.filter((e) => e.committedTeamId === dynasty.userTeamId);

  if (userCommits.length > 0) {
    const defaultTraits: LacrossePlayerTraits = {
      shooting: 50,
      passing: 50,
      dodging: 50,
      stickSkills: 55,
      offBallMovement: 50,
      defense: 50,
      checking: 45,
      groundBalls: 55,
      preferredHand: 'right',
    };

    const newPlayers: LacrossePlayer[] = userCommits.map((entry) => ({
      id: `portal-player-${entry.id}`,
      name: entry.name,
      age: 19,
      classYear: entry.classYear,
      hometown: entry.regionId,
      regionId: entry.regionId,
      position: entry.position,
      secondaryPositions: [],
      ratings: entry.ratings,
      traits: [],
      sportTraits: (entry.sportTraits ?? defaultTraits) as LacrossePlayerTraits,
      scholarshipPercent: entry.offersByTeamId[dynasty.userTeamId] ?? 100,
      isWalkOn: false,
      morale: 80,
      health: 100,
      fatigue: 0,
      redshirtStatus: 'none' as const,
      eligibility: eligibilityForClass(entry.classYear),
      createdSeason: dynasty.season.year,
    }));

    const scholarshipDelta = newPlayers.reduce((sum, p) => sum + p.scholarshipPercent / 100, 0);

    updatedTeams = updatedTeams.map((team) => {
      if (team.id !== dynasty.userTeamId) return team;
      return {
        ...team,
        roster: [...team.roster, ...newPlayers],
        resources: {
          ...team.resources,
          scholarshipUsed: Math.min(
            team.resources.scholarshipLimit,
            team.resources.scholarshipUsed + scholarshipDelta,
          ),
        },
      };
    });
  }

  return {
    ...dynasty,
    season: { ...dynasty.season, teams: updatedTeams },
    portalEntries: resolved,
  };
}

function eligibilityForClass(classYear: PlayerClass): EligibilityStatus {
  const map: Record<PlayerClass, { played: number; remaining: number }> = {
    FR: { played: 0, remaining: 4 },
    SO: { played: 1, remaining: 3 },
    JR: { played: 2, remaining: 2 },
    SR: { played: 3, remaining: 1 },
    GR: { played: 4, remaining: 1 },
  };
  const { played, remaining } = map[classYear];
  return { seasonsPlayed: played, seasonsRemaining: remaining, isEligible: remaining > 0 };
}

function generatePortalEntries(
  teams: LacrosseTeam[],
  userTeamId: string,
  seed: number,
): LacrossePortalEntry[] {
  const random = seededRandom(seed + 777);
  const PORTAL_RATE = 0.12;
  const entries: LacrossePortalEntry[] = [];

  for (const team of teams) {
    if (team.id === userTeamId) continue;
    for (const player of team.roster) {
      // Only SO and JR typically transfer; FR rarely; SR/GR graduate
      if (player.classYear === 'FR' || player.classYear === 'SR' || player.classYear === 'GR') continue;
      if (random() >= PORTAL_RATE) continue;

      entries.push({
        id: `portal-${seed}-${player.id}`,
        playerId: player.id,
        name: player.name,
        position: player.position,
        classYear: player.classYear,
        ratings: player.ratings,
        sportTraits: player.sportTraits as LacrossePlayerTraits,
        sourceTeamId: team.id,
        regionId: player.regionId,
        status: 'available',
        preferences: {
          proximityImportance: 40 + Math.round(random() * 60),
          prestigeImportance: 40 + Math.round(random() * 60),
          scholarshipImportance: 55 + Math.round(random() * 45),
          playingTimeImportance: 65 + Math.round(random() * 35),
          academicImportance: 25 + Math.round(random() * 55),
        },
        interestByTeamId: {},
        offersByTeamId: {},
      });
    }
  }

  return entries;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function evolvePrestige(
  teams: LacrosseTeam[],
  standings: StandingsEntry[],
  nationalChampionId?: string,
): LacrosseTeam[] {
  return teams.map((team) => {
    const standing = standings.find((s) => s.teamId === team.id);
    const wins = standing?.record.wins ?? 0;
    const losses = standing?.record.losses ?? 0;
    const total = wins + losses;
    const winPct = total > 0 ? wins / total : 0.5;
    const perfBase = Math.round(winPct * 100);

    // Drift recentSuccess toward season performance
    const gap = perfBase - team.reputation.recentSuccess;
    const drift = Math.round(gap * 0.3);
    let recentSuccess = Math.min(99, Math.max(40, team.reputation.recentSuccess + drift));
    let nationalPrestige = team.reputation.nationalPrestige;

    if (team.id === nationalChampionId) {
      recentSuccess = Math.min(99, recentSuccess + 8);
      nationalPrestige = Math.min(99, nationalPrestige + 5);
    } else if (winPct > 0.75) {
      nationalPrestige = Math.min(99, nationalPrestige + 2);
    } else if (winPct > 0.6) {
      nationalPrestige = Math.min(99, nationalPrestige + 1);
    } else if (winPct < 0.35) {
      nationalPrestige = Math.max(40, nationalPrestige - 1);
    }

    return {
      ...team,
      reputation: { ...team.reputation, recentSuccess, nationalPrestige },
    };
  });
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

// Each CPU team extends offers to their top 15 open recruits at 50% scholarship
function applyeCpuOffers(
  recruits: LacrosseRecruit[],
  teams: LacrosseTeam[],
  userTeamId: string,
): LacrosseRecruit[] {
  const rosterTargets = { ATT: 8, MID: 16, DEF: 10, GK: 4, FOGO: 3, LSM: 4 } as const;
  const updated = [...recruits];

  for (const team of teams) {
    if (team.id === userTeamId) continue;
    const openRecruits = updated.filter((r) => r.status === 'open');
    const board = sortRecruitBoardForTeam(team, openRecruits, rosterTargets);
    for (const entry of board.slice(0, 15)) {
      const idx = updated.findIndex((r) => r.id === entry.recruit.id);
      if (idx >= 0) {
        updated[idx] = applyScholarshipOffer(updated[idx]!, team.id, 50);
      }
    }
  }

  return updated;
}
