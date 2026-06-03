import { createNewLacrosseDynasty } from '@sports-management-sim/sport-lacrosse';
import type { LacrosseDynastyState } from '@sports-management-sim/sport-lacrosse';
import { formatTeamName } from './ui/format';

const DEFAULT_USER_TEAM_ID = 'maryland-state';
const DEFAULT_SEASON_YEAR = 2028;
let lastIssuedSeed = 0;

export interface FreshDynastyOptions {
  userTeamId?: string;
  seasonYear?: number;
  now?: () => number;
}

export interface DynastyTeamChoice {
  id: string;
  name: string;
  conferenceId?: string;
  prestige: number;
}

export function getLacrosseDynastyTeamChoices(): DynastyTeamChoice[] {
  return createNewLacrosseDynasty({
    seed: 1,
    userTeamId: DEFAULT_USER_TEAM_ID,
    seasonYear: DEFAULT_SEASON_YEAR,
  }).season.teams.map((team) => ({
    id: team.id,
    name: formatTeamName(team.name),
    conferenceId: team.conferenceId,
    prestige: team.reputation.nationalPrestige,
  }));
}

export function createFreshLacrosseDynasty({
  userTeamId = DEFAULT_USER_TEAM_ID,
  seasonYear = DEFAULT_SEASON_YEAR,
  now = Date.now,
}: FreshDynastyOptions = {}): LacrosseDynastyState {
  const seed = nextDynastySeed(now);
  return createNewLacrosseDynasty({ seed, userTeamId, seasonYear });
}

function nextDynastySeed(now: () => number): number {
  const candidate = Math.max(1, Math.floor(now()));
  lastIssuedSeed = Math.max(candidate, lastIssuedSeed + 1);
  return lastIssuedSeed;
}
