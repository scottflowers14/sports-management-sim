import {
  createRoundRobinSchedule,
  sortRecruitBoardForTeam,
  type Conference,
  type RecruitBoardEntry,
  type Region,
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
  const schedule = createRoundRobinSchedule(
    teams.map((team) => team.id),
    seasonYear,
  );
  const conferences = createConferences(teams);
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
    makeLacrosseTeam('maryland-state'),
    makeLacrosseTeam('long-island-tech'),
    makeLacrosseTeam('colorado-front-range'),
    makeLacrosseTeam('new-england-college'),
  ];
}

function createConferences(teams: LacrosseTeam[]): Conference[] {
  return [
    {
      id: 'conference-1',
      name: 'Premier Lacrosse Conference',
      shortName: 'PLC',
      teamIds: teams.map((team) => team.id),
      prestige: 70,
      regionIds: ['mid-atlantic', 'long-island', 'colorado', 'new-england'],
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
