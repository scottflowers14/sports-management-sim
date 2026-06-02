import {
  createRoundRobinSchedule,
  sortRecruitBoardForTeam,
  type Conference,
  type RecruitBoardEntry,
  type Region,
  type ScheduledGame,
} from '@sports-management-sim/engine-core';
import type { LacrossePlayerTraits, LacrossePosition, LacrosseSeason, LacrosseTeam } from './models';
import { generateLacrosseRecruitingClass, type LacrosseRecruit } from './recruit-generation';
import { makeLacrosseTeam } from './test-fixtures';

export interface LacrosseDynastyState {
  id: string;
  seed: number;
  userTeamId: string;
  season: LacrosseSeason;
  recruits: LacrosseRecruit[];
  recruitBoard: RecruitBoardEntry<LacrossePosition, LacrossePlayerTraits>[];
  rosterTargets: Record<LacrossePosition, number>;
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
  const accSchedule = createRoundRobinSchedule(accIds, seasonYear, { conferenceGame: true, startWeek: 1 });
  const necSchedule = createRoundRobinSchedule(necIds, seasonYear, { conferenceGame: true, startWeek: 1 });
  return [...accSchedule, ...necSchedule, ...createCrossConferenceSchedule(seasonYear)];
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
  const recruitBoard = sortRecruitBoardForTeam(userTeam, recruits, DEFAULT_LACROSSE_ROSTER_TARGETS);

  const accIds = ['maryland-state', 'virginia-lakes', 'long-island-tech', 'georgetown-prep'];
  const necIds = ['new-england-college', 'colorado-front-range', 'syracuse-heights', 'penn-state-valley'];
  const schedule = createLacrosseSeasonSchedule(seasonYear);
  const conferences = createConferences(accIds, necIds);
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
    rosterTargets: DEFAULT_LACROSSE_ROSTER_TARGETS,
  };
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
  ];
}

function createCrossConferenceSchedule(seasonYear: number): ScheduledGame[] {
  const matchups: Array<{ week: number; homeTeamId: string; awayTeamId: string }> = [
    { week: 7, homeTeamId: 'maryland-state', awayTeamId: 'new-england-college' },
    { week: 8, homeTeamId: 'virginia-lakes', awayTeamId: 'colorado-front-range' },
    { week: 9, homeTeamId: 'long-island-tech', awayTeamId: 'syracuse-heights' },
    { week: 10, homeTeamId: 'georgetown-prep', awayTeamId: 'penn-state-valley' },
    { week: 11, homeTeamId: 'new-england-college', awayTeamId: 'long-island-tech' },
    { week: 12, homeTeamId: 'colorado-front-range', awayTeamId: 'maryland-state' },
    { week: 13, homeTeamId: 'syracuse-heights', awayTeamId: 'georgetown-prep' },
    { week: 14, homeTeamId: 'penn-state-valley', awayTeamId: 'virginia-lakes' },
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

function createConferences(accIds: string[], necIds: string[]): Conference[] {
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
  ];
}

function createRegions(): Region[] {
  return [
    { id: 'mid-atlantic', name: 'Mid-Atlantic', country: 'USA', recruitingHotbedScore: 95 },
    { id: 'long-island', name: 'Long Island', country: 'USA', state: 'NY', recruitingHotbedScore: 92 },
    { id: 'upstate-ny', name: 'Upstate New York', country: 'USA', state: 'NY', recruitingHotbedScore: 88 },
    { id: 'new-england', name: 'New England', country: 'USA', recruitingHotbedScore: 82 },
    { id: 'colorado', name: 'Colorado', country: 'USA', state: 'CO', recruitingHotbedScore: 76 },
    { id: 'southeast', name: 'Southeast', country: 'USA', recruitingHotbedScore: 58 },
    { id: 'midwest', name: 'Midwest', country: 'USA', recruitingHotbedScore: 52 },
    { id: 'west', name: 'West', country: 'USA', recruitingHotbedScore: 45 },
  ];
}
