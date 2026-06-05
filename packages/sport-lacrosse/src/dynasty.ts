import {
  advanceSeasonWeek,
  applyPortalOffer,
  applyScholarshipOffer,
  calculateRecruitFitScore,
  createRoundRobinSchedule,
  resolvePortalCommitments,
  sortRecruitBoardForTeam,
  type Conference,
  type PortalEntry,
  type RecruitBoardEntry,
  type Region,
  type ScheduledGame,
} from '@sports-management-sim/engine-core';
import type { LacrossePlayerTraits, LacrossePosition, LacrosseSeason, LacrosseTeam } from './models';
import { generateLacrosseRecruitingClass, type LacrosseRecruit } from './recruit-generation';
import { makeLacrosseTeam } from './test-fixtures';
import { simulateLacrosseGame } from './simulate-game';

export type LacrossePortalEntry = PortalEntry<LacrossePosition, LacrossePlayerTraits>;

export interface LacrosseDynastyState {
  id: string;
  seed: number;
  userTeamId: string;
  season: LacrosseSeason;
  recruits: LacrosseRecruit[];
  recruitBoard: RecruitBoardEntry<LacrossePosition, LacrossePlayerTraits>[];
  recruitingClass: LacrosseRecruit[];
  rosterTargets: Record<LacrossePosition, number>;
  portalEntries: LacrossePortalEntry[];
}

export interface LacrosseRecruitingSummary {
  offersUsed: number;
  commitments: number;
  classScore: number;
}

export interface CreateNewLacrosseDynastyOptions {
  seed: number;
  userTeamId: string;
  seasonYear: number;
}

export const DEFAULT_LACROSSE_ROSTER_TARGETS: Record<LacrossePosition, number> = {
  ATT: 8,
  MID: 16,
  DEF: 10,
  GK: 4,
  FOGO: 3,
  LSM: 4,
};

interface TeamOverride {
  name: string;
  regionId: string;
  conferenceId: string;
  nationalPrestige: number;
  academicPrestige: number;
  coachingPrestige: number;
  facilities: number;
  fanSupport: number;
  recentSuccess: number;
}

const TEAM_OVERRIDES: Record<string, TeamOverride> = {
  'maryland-state': {
    name: 'Maryland State',
    regionId: 'mid-atlantic',
    conferenceId: 'acc',
    nationalPrestige: 85,
    academicPrestige: 72,
    coachingPrestige: 82,
    facilities: 88,
    fanSupport: 80,
    recentSuccess: 78,
  },
  'virginia-lakes': {
    name: 'Virginia Lakes',
    regionId: 'mid-atlantic',
    conferenceId: 'acc',
    nationalPrestige: 75,
    academicPrestige: 78,
    coachingPrestige: 74,
    facilities: 76,
    fanSupport: 70,
    recentSuccess: 68,
  },
  'long-island-tech': {
    name: 'Long Island Tech',
    regionId: 'long-island',
    conferenceId: 'acc',
    nationalPrestige: 80,
    academicPrestige: 68,
    coachingPrestige: 78,
    facilities: 82,
    fanSupport: 75,
    recentSuccess: 74,
  },
  'georgetown-prep': {
    name: 'Georgetown Prep',
    regionId: 'mid-atlantic',
    conferenceId: 'acc',
    nationalPrestige: 68,
    academicPrestige: 88,
    coachingPrestige: 66,
    facilities: 70,
    fanSupport: 65,
    recentSuccess: 60,
  },
  'new-england-college': {
    name: 'New England College',
    regionId: 'new-england',
    conferenceId: 'nec',
    nationalPrestige: 72,
    academicPrestige: 82,
    coachingPrestige: 70,
    facilities: 74,
    fanSupport: 68,
    recentSuccess: 65,
  },
  'colorado-front-range': {
    name: 'Colorado Front Range',
    regionId: 'colorado',
    conferenceId: 'nec',
    nationalPrestige: 62,
    academicPrestige: 65,
    coachingPrestige: 60,
    facilities: 64,
    fanSupport: 60,
    recentSuccess: 55,
  },
  'syracuse-heights': {
    name: 'Syracuse Heights',
    regionId: 'upstate-ny',
    conferenceId: 'nec',
    nationalPrestige: 78,
    academicPrestige: 70,
    coachingPrestige: 76,
    facilities: 80,
    fanSupport: 74,
    recentSuccess: 72,
  },
  'penn-state-valley': {
    name: 'Penn State Valley',
    regionId: 'mid-atlantic',
    conferenceId: 'nec',
    nationalPrestige: 70,
    academicPrestige: 75,
    coachingPrestige: 68,
    facilities: 72,
    fanSupport: 68,
    recentSuccess: 63,
  },
  'ohio-summit': {
    name: 'Ohio Summit',
    regionId: 'ohio-valley',
    conferenceId: 'b10',
    nationalPrestige: 65,
    academicPrestige: 72,
    coachingPrestige: 63,
    facilities: 67,
    fanSupport: 62,
    recentSuccess: 58,
  },
  'michigan-bay': {
    name: 'Michigan Bay',
    regionId: 'great-lakes',
    conferenceId: 'b10',
    nationalPrestige: 68,
    academicPrestige: 74,
    coachingPrestige: 66,
    facilities: 70,
    fanSupport: 65,
    recentSuccess: 62,
  },
  'penn-grove': {
    name: 'Penn Grove',
    regionId: 'mid-atlantic',
    conferenceId: 'b10',
    nationalPrestige: 62,
    academicPrestige: 76,
    coachingPrestige: 60,
    facilities: 64,
    fanSupport: 58,
    recentSuccess: 55,
  },
  'illinois-central': {
    name: 'Illinois Central',
    regionId: 'midwest',
    conferenceId: 'b10',
    nationalPrestige: 58,
    academicPrestige: 70,
    coachingPrestige: 56,
    facilities: 60,
    fanSupport: 55,
    recentSuccess: 50,
  },
  'california-coast': {
    name: 'California Coast',
    regionId: 'california',
    conferenceId: 'pac',
    nationalPrestige: 55,
    academicPrestige: 68,
    coachingPrestige: 54,
    facilities: 58,
    fanSupport: 52,
    recentSuccess: 48,
  },
  'denver-ridge': {
    name: 'Denver Ridge',
    regionId: 'rocky-mountain',
    conferenceId: 'pac',
    nationalPrestige: 60,
    academicPrestige: 65,
    coachingPrestige: 58,
    facilities: 62,
    fanSupport: 56,
    recentSuccess: 52,
  },
  'utah-canyon': {
    name: 'Utah Canyon',
    regionId: 'rocky-mountain',
    conferenceId: 'pac',
    nationalPrestige: 52,
    academicPrestige: 62,
    coachingPrestige: 50,
    facilities: 54,
    fanSupport: 48,
    recentSuccess: 44,
  },
  'oregon-cascade': {
    name: 'Oregon Cascade',
    regionId: 'pacific-northwest',
    conferenceId: 'pac',
    nationalPrestige: 50,
    academicPrestige: 64,
    coachingPrestige: 48,
    facilities: 52,
    fanSupport: 46,
    recentSuccess: 42,
  },
};

function makeTeamWithOverride(id: string): LacrosseTeam {
  const base = makeLacrosseTeam(id);
  const override = TEAM_OVERRIDES[id];
  if (override === undefined) {
    return base;
  }
  return {
    ...base,
    name: override.name,
    shortName: override.name,
    schoolName: override.name,
    regionId: override.regionId,
    conferenceId: override.conferenceId,
    reputation: {
      nationalPrestige: override.nationalPrestige,
      academicPrestige: override.academicPrestige,
      coachingPrestige: override.coachingPrestige,
      facilities: override.facilities,
      fanSupport: override.fanSupport,
      recentSuccess: override.recentSuccess,
    },
  };
}

export function createLacrosseSeasonSchedule(seasonYear: number): ScheduledGame[] {
  const accIds = ['maryland-state', 'virginia-lakes', 'long-island-tech', 'georgetown-prep'];
  const necIds = ['new-england-college', 'colorado-front-range', 'syracuse-heights', 'penn-state-valley'];
  const b10Ids = ['ohio-summit', 'michigan-bay', 'penn-grove', 'illinois-central'];
  const pacIds = ['california-coast', 'denver-ridge', 'utah-canyon', 'oregon-cascade'];
  const accSchedule = createRoundRobinSchedule(accIds, seasonYear, { conferenceGame: true, startWeek: 1 });
  const necSchedule = createRoundRobinSchedule(necIds, seasonYear, { conferenceGame: true, startWeek: 1 });
  const b10Schedule = createRoundRobinSchedule(b10Ids, seasonYear, { conferenceGame: true, startWeek: 1 });
  const pacSchedule = createRoundRobinSchedule(pacIds, seasonYear, { conferenceGame: true, startWeek: 1 });
  return [...accSchedule, ...necSchedule, ...b10Schedule, ...pacSchedule, ...createCrossConferenceSchedule(seasonYear)];
}

export function createNewLacrosseDynasty({
  seed,
  userTeamId,
  seasonYear,
}: CreateNewLacrosseDynastyOptions): LacrosseDynastyState {
  const teams = createInitialTeams();
  const userTeam = teams.find((team) => team.id === userTeamId);

  if (userTeam === undefined) {
    throw new Error(`Unknown lacrosse dynasty userTeamId: ${userTeamId}`);
  }

  const recruits = generateLacrosseRecruitingClass({ count: 80, seed });
  const recruitBoard = sortRecruitBoardForTeam(userTeam, openRecruits(recruits), DEFAULT_LACROSSE_ROSTER_TARGETS);

  const accIds = ['maryland-state', 'virginia-lakes', 'long-island-tech', 'georgetown-prep'];
  const necIds = ['new-england-college', 'colorado-front-range', 'syracuse-heights', 'penn-state-valley'];
  const b10Ids = ['ohio-summit', 'michigan-bay', 'penn-grove', 'illinois-central'];
  const pacIds = ['california-coast', 'denver-ridge', 'utah-canyon', 'oregon-cascade'];
  const schedule = createLacrosseSeasonSchedule(seasonYear);
  const conferences = createConferences(accIds, necIds, b10Ids, pacIds);
  const regions = createRegions();

  return {
    id: `lacrosse-dynasty-${seed}`,
    seed,
    userTeamId,
    season: {
      year: seasonYear,
      teams,
      conferences,
      regions,
      schedule,
      standings: [],
      currentWeek: 1,
      phase: 'regular_season',
    },
    recruits,
    recruitBoard,
    recruitingClass: [],
    rosterTargets: DEFAULT_LACROSSE_ROSTER_TARGETS,
    portalEntries: [],
  };
}

export function offerLacrosseRecruitScholarship(
  state: LacrosseDynastyState,
  recruitId: string,
  scholarshipPercent = 100,
): LacrosseDynastyState {
  const recruit = state.recruits.find((candidate) => candidate.id === recruitId);

  if (recruit === undefined) {
    throw new Error(`Unknown lacrosse recruitId: ${recruitId}`);
  }

  if (recruit.status !== 'open') {
    return state;
  }

  const userTeam = findUserTeam(state);
  const recruits = state.recruits.map((candidate) =>
    candidate.id === recruitId ? applyScholarshipOffer(candidate, state.userTeamId, scholarshipPercent) : candidate,
  );

  return buildRecruitingState({ ...state, recruits }, userTeam);
}

export function offerLacrossePortalPlayer(
  state: LacrosseDynastyState,
  portalEntryId: string,
  scholarshipPercent = 100,
): LacrosseDynastyState {
  const portalEntries = state.portalEntries.map((entry) =>
    entry.id === portalEntryId
      ? applyPortalOffer(entry, state.userTeamId, scholarshipPercent)
      : entry,
  );
  return { ...state, portalEntries };
}

export function resolveLacrossePortal(state: LacrosseDynastyState): LacrosseDynastyState {
  const resolved = resolvePortalCommitments(state.portalEntries, state.season.teams);
  return { ...state, portalEntries: resolved };
}

export function getLacrosseRecruitingSummary(state: LacrosseDynastyState): LacrosseRecruitingSummary {
  const offeredRecruitIds = new Set<string>();
  const recruitingClass = state.recruitingClass;

  for (const recruit of state.recruits) {
    if (recruit.status === 'open' && recruit.scholarshipOffers.some((offer) => offer.teamId === state.userTeamId)) {
      offeredRecruitIds.add(recruit.id);
    }
  }

  return {
    offersUsed: offeredRecruitIds.size,
    commitments: recruitingClass.length,
    classScore: recruitingClass.reduce((score, recruit) => score + recruit.starRating * 100 + recruit.ratings.potential, 0),
  };
}

export function advanceLacrosseDynastyWeek(state: LacrosseDynastyState): LacrosseDynastyState {
  if (state.season.phase === 'complete') {
    return state;
  }

  const random = createSeededRandom(state.seed + state.season.year * 100 + state.season.currentWeek);
  const advancedSeason = advanceSeasonWeek(state.season, (_game, homeTeam, awayTeam) =>
    simulateLacrosseGame({ homeTeam, awayTeam, random }),
  );
  const hasRemainingScheduledGames = advancedSeason.schedule.some((game) => game.status === 'scheduled');
  const season = {
    ...advancedSeason,
    phase: hasRemainingScheduledGames ? advancedSeason.phase : ('complete' as const),
  };
  const userTeam = season.teams.find((team) => team.id === state.userTeamId);

  if (userTeam === undefined) {
    throw new Error(`Unknown lacrosse dynasty userTeamId: ${state.userTeamId}`);
  }

  const recruits = resolveWeeklyRecruiting(
    state.recruits,
    season.teams,
    state.userTeamId,
    state.season.currentWeek,
  );

  return buildRecruitingState(
    {
      ...state,
      season,
      recruits,
    },
    userTeam,
  );
}

function findUserTeam(state: LacrosseDynastyState): LacrosseTeam {
  const userTeam = state.season.teams.find((team) => team.id === state.userTeamId);

  if (userTeam === undefined) {
    throw new Error(`Unknown lacrosse dynasty userTeamId: ${state.userTeamId}`);
  }

  return userTeam;
}

function buildRecruitingState(state: LacrosseDynastyState, userTeam: LacrosseTeam): LacrosseDynastyState {
  const recruitingClass = state.recruits.filter(
    (recruit) => recruit.status === 'committed' && recruit.committedTeamId === state.userTeamId,
  );

  return {
    ...state,
    recruitBoard: sortRecruitBoardForTeam(userTeam, openRecruits(state.recruits), state.rosterTargets),
    recruitingClass,
  };
}

function resolveWeeklyRecruiting(
  recruits: LacrosseRecruit[],
  allTeams: LacrosseTeam[],
  userTeamId: string,
  currentWeek: number,
): LacrosseRecruit[] {
  const userTeam = allTeams.find((t) => t.id === userTeamId);

  // Apply CPU weekly offers (teams gradually build their offer lists)
  let updated = applyCpuWeeklyOffers(recruits, allTeams, userTeamId);

  return updated.map((recruit) => {
    if (recruit.status !== 'open') return recruit;
    if (recruit.scholarshipOffers.length === 0) return recruit;

    // Build interest for every team that holds an offer
    const updatedInterest = { ...recruit.interestByTeamId };

    for (const offer of recruit.scholarshipOffers) {
      const team = allTeams.find((t) => t.id === offer.teamId);
      if (!team) continue;
      const current = updatedInterest[team.id] ?? 0;
      if (team.id === userTeamId && userTeam) {
        const fitScore = calculateRecruitFitScore(recruit, userTeam);
        const gain = Math.round(
          11 + recruit.starRating * 2 + fitScore * 0.05 + recruit.preferences.scholarshipImportance * 0.04,
        );
        updatedInterest[team.id] = clamp(current + gain, 0, 100);
      } else {
        // CPU teams: prestige-weighted gain, no fitScore calculation
        const prestigeBonus = Math.round((team.reputation.nationalPrestige / 100) * 5);
        const gain = 6 + recruit.starRating + prestigeBonus;
        updatedInterest[team.id] = clamp(current + gain, 0, 100);
      }
    }

    // Check if any offering team has crossed the commitment threshold
    const threshold = commitmentThreshold(recruit, currentWeek);
    const aboveThreshold = recruit.scholarshipOffers
      .map((o) => ({ teamId: o.teamId, interest: updatedInterest[o.teamId] ?? 0 }))
      .filter((t) => t.interest >= threshold)
      .sort((a, b) => b.interest - a.interest);

    const committingTo = aboveThreshold[0];

    return {
      ...recruit,
      interestByTeamId: updatedInterest,
      ...(committingTo
        ? { status: 'committed' as const, committedTeamId: committingTo.teamId }
        : {}),
    };
  });
}

function applyCpuWeeklyOffers(
  recruits: LacrosseRecruit[],
  allTeams: LacrosseTeam[],
  userTeamId: string,
): LacrosseRecruit[] {
  const CPU_MAX_OFFERS = 12;
  const CPU_WEEKLY_NEW_OFFERS = 2;

  let updated = [...recruits];

  for (const team of allTeams) {
    if (team.id === userTeamId) continue;

    const alreadyOfferedIds = new Set(
      updated
        .filter((r) => r.scholarshipOffers.some((o) => o.teamId === team.id))
        .map((r) => r.id),
    );

    if (alreadyOfferedIds.size >= CPU_MAX_OFFERS) continue;

    const canOffer = Math.min(CPU_WEEKLY_NEW_OFFERS, CPU_MAX_OFFERS - alreadyOfferedIds.size);
    const open = updated.filter((r) => r.status === 'open' && !alreadyOfferedIds.has(r.id));
    const board = sortRecruitBoardForTeam(team, open, DEFAULT_LACROSSE_ROSTER_TARGETS);

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

function commitmentThreshold(recruit: LacrosseRecruit, currentWeek: number): number {
  return clamp(84 - currentWeek * 5 + recruit.starRating, 58, 84);
}

function hasUserOffer(recruit: LacrosseRecruit, teamId: string): boolean {
  return recruit.scholarshipOffers.some((offer) => offer.teamId === teamId);
}

function openRecruits(recruits: LacrosseRecruit[]): LacrosseRecruit[] {
  return recruits.filter((recruit) => recruit.status === 'open');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createInitialTeams(): LacrosseTeam[] {
  return [
    makeTeamWithOverride('maryland-state'),
    makeTeamWithOverride('virginia-lakes'),
    makeTeamWithOverride('long-island-tech'),
    makeTeamWithOverride('georgetown-prep'),
    makeTeamWithOverride('new-england-college'),
    makeTeamWithOverride('colorado-front-range'),
    makeTeamWithOverride('syracuse-heights'),
    makeTeamWithOverride('penn-state-valley'),
    makeTeamWithOverride('ohio-summit'),
    makeTeamWithOverride('michigan-bay'),
    makeTeamWithOverride('penn-grove'),
    makeTeamWithOverride('illinois-central'),
    makeTeamWithOverride('california-coast'),
    makeTeamWithOverride('denver-ridge'),
    makeTeamWithOverride('utah-canyon'),
    makeTeamWithOverride('oregon-cascade'),
  ];
}

function createCrossConferenceSchedule(seasonYear: number): ScheduledGame[] {
  const matchups: Array<{ week: number; homeTeamId: string; awayTeamId: string }> = [
    // ACC vs NEC (weeks 7-10)
    { week: 7, homeTeamId: 'maryland-state', awayTeamId: 'new-england-college' },
    { week: 8, homeTeamId: 'virginia-lakes', awayTeamId: 'colorado-front-range' },
    { week: 9, homeTeamId: 'long-island-tech', awayTeamId: 'syracuse-heights' },
    { week: 10, homeTeamId: 'georgetown-prep', awayTeamId: 'penn-state-valley' },
    // B10 vs PAC (weeks 7-10)
    { week: 7, homeTeamId: 'ohio-summit', awayTeamId: 'california-coast' },
    { week: 8, homeTeamId: 'michigan-bay', awayTeamId: 'denver-ridge' },
    { week: 9, homeTeamId: 'penn-grove', awayTeamId: 'utah-canyon' },
    { week: 10, homeTeamId: 'illinois-central', awayTeamId: 'oregon-cascade' },
    // ACC vs B10 (weeks 11-14)
    { week: 11, homeTeamId: 'maryland-state', awayTeamId: 'ohio-summit' },
    { week: 12, homeTeamId: 'virginia-lakes', awayTeamId: 'michigan-bay' },
    { week: 13, homeTeamId: 'long-island-tech', awayTeamId: 'penn-grove' },
    { week: 14, homeTeamId: 'georgetown-prep', awayTeamId: 'illinois-central' },
    // NEC vs PAC (weeks 11-14)
    { week: 11, homeTeamId: 'new-england-college', awayTeamId: 'california-coast' },
    { week: 12, homeTeamId: 'colorado-front-range', awayTeamId: 'denver-ridge' },
    { week: 13, homeTeamId: 'syracuse-heights', awayTeamId: 'utah-canyon' },
    { week: 14, homeTeamId: 'penn-state-valley', awayTeamId: 'oregon-cascade' },
  ];

  return matchups.map(({ week, homeTeamId, awayTeamId }) => ({
    id: `${seasonYear}-week-${week}-${homeTeamId}-vs-${awayTeamId}`,
    seasonYear,
    week,
    homeTeamId,
    awayTeamId,
    conferenceGame: false,
    status: 'scheduled',
  }));
}

function createConferences(accIds: string[], necIds: string[], b10Ids: string[], pacIds: string[]): Conference[] {
  return [
    {
      id: 'acc',
      name: 'Atlantic Coast Conference',
      shortName: 'ACC',
      teamIds: accIds,
      prestige: 80,
      regionIds: ['mid-atlantic', 'long-island'],
    },
    {
      id: 'nec',
      name: 'Northeast Conference',
      shortName: 'NEC',
      teamIds: necIds,
      prestige: 70,
      regionIds: ['new-england', 'colorado', 'upstate-ny', 'mid-atlantic'],
    },
    {
      id: 'b10',
      name: 'Midwest Lacrosse Conference',
      shortName: 'MLC',
      teamIds: b10Ids,
      prestige: 62,
      regionIds: ['ohio-valley', 'great-lakes', 'midwest', 'mid-atlantic'],
    },
    {
      id: 'pac',
      name: 'Western Lacrosse Conference',
      shortName: 'WLC',
      teamIds: pacIds,
      prestige: 55,
      regionIds: ['california', 'rocky-mountain', 'pacific-northwest'],
    },
  ];
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function createRegions(): Region[] {
  return [
    { id: 'mid-atlantic', name: 'Mid-Atlantic', country: 'USA', recruitingHotbedScore: 95 },
    { id: 'long-island', name: 'Long Island', country: 'USA', state: 'NY', recruitingHotbedScore: 92 },
    { id: 'upstate-ny', name: 'Upstate New York', country: 'USA', state: 'NY', recruitingHotbedScore: 88 },
    { id: 'new-england', name: 'New England', country: 'USA', recruitingHotbedScore: 82 },
    { id: 'colorado', name: 'Colorado', country: 'USA', state: 'CO', recruitingHotbedScore: 76 },
    { id: 'southeast', name: 'Southeast', country: 'USA', recruitingHotbedScore: 58 },
    { id: 'midwest', name: 'Midwest', country: 'USA', recruitingHotbedScore: 55 },
    { id: 'west', name: 'West', country: 'USA', recruitingHotbedScore: 45 },
    { id: 'ohio-valley', name: 'Ohio Valley', country: 'USA', recruitingHotbedScore: 68 },
    { id: 'great-lakes', name: 'Great Lakes', country: 'USA', recruitingHotbedScore: 65 },
    { id: 'california', name: 'California', country: 'USA', state: 'CA', recruitingHotbedScore: 62 },
    { id: 'rocky-mountain', name: 'Rocky Mountain', country: 'USA', recruitingHotbedScore: 58 },
    { id: 'pacific-northwest', name: 'Pacific Northwest', country: 'USA', recruitingHotbedScore: 50 },
  ];
}
