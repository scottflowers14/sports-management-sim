import { createNewLacrosseDynasty, ensureHeadCoaches, validateCustomTeamsFile } from '@sports-management-sim/sport-lacrosse';
import type { CustomTeamsFile, CustomTeamsValidationError } from '@sports-management-sim/sport-lacrosse';
import type { LacrosseDynastyState } from '@sports-management-sim/sport-lacrosse';
import { formatTeamName } from './ui/format';

const DEFAULT_USER_TEAM_ID = 'maryland-state';
const DEFAULT_SEASON_YEAR = 2028;
const CUSTOM_TEAMS_KEY = 'sports-management-sim:custom-teams:v1';
let lastIssuedSeed = 0;

export interface FreshDynastyOptions {
  userTeamId?: string;
  seasonYear?: number;
  now?: () => number;
  customTeams?: CustomTeamsFile;
}

export interface DynastyTeamChoice {
  id: string;
  name: string;
  conferenceId?: string;
  conferenceName?: string;
  prestige: number;
}

export type ProgramTier = 'Blue blood' | 'Contender' | 'Rising' | 'Rebuild';

/** What the job is like, in a word, from the program's prestige. */
export function programTier(prestige: number): ProgramTier {
  return prestige >= 80 ? 'Blue blood' : prestige >= 66 ? 'Contender' : prestige >= 54 ? 'Rising' : 'Rebuild';
}

export const PROGRAM_TIER_NOTES: Record<ProgramTier, string> = {
  'Blue blood': 'Title or bust. Elite recruits listen, and the AD expects a deep NCAA run every year.',
  Contender: 'Good enough to win now with room to grow. The friendliest start for a new coach.',
  Rising: 'A solid base. Win your conference games and the top recruits start calling back.',
  Rebuild: 'Short on talent and name. Recruit to your level and build it up over several seasons.',
};

/** A beginner-friendly program: the strongest Contender, else the closest tier to it. */
export function recommendedStarterTeam(choices: readonly DynastyTeamChoice[]): DynastyTeamChoice | undefined {
  const contenders = choices.filter((c) => programTier(c.prestige) === 'Contender');
  const pool = contenders.length > 0 ? contenders : [...choices];
  return [...pool].sort((a, b) => (contenders.length > 0 ? b.prestige - a.prestige : Math.abs(a.prestige - 72) - Math.abs(b.prestige - 72)))[0];
}

export function getLacrosseDynastyTeamChoices(customTeams?: CustomTeamsFile): DynastyTeamChoice[] {
  const firstTeamId = customTeams?.teams[0]?.id ?? DEFAULT_USER_TEAM_ID;
  const { season } = createNewLacrosseDynasty({
    seed: 1,
    userTeamId: firstTeamId,
    seasonYear: DEFAULT_SEASON_YEAR,
    ...(customTeams ? { customTeams } : {}),
  });
  const conferenceNames = new Map(season.conferences.map((c) => [c.id, c.name]));
  return season.teams.map((team) => {
    const conferenceName = conferenceNames.get(team.conferenceId);
    return {
      id: team.id,
      name: formatTeamName(team.name),
      conferenceId: team.conferenceId,
      ...(conferenceName ? { conferenceName } : {}),
      prestige: team.reputation.nationalPrestige,
    };
  });
}

export function createFreshLacrosseDynasty({
  userTeamId,
  seasonYear = DEFAULT_SEASON_YEAR,
  now = Date.now,
  customTeams,
}: FreshDynastyOptions = {}): LacrosseDynastyState {
  const resolvedCustomTeams = customTeams ?? loadCustomTeamsConfig();
  const resolvedUserTeamId = userTeamId
    ?? resolvedCustomTeams?.teams[0]?.id
    ?? DEFAULT_USER_TEAM_ID;
  const seed = nextDynastySeed(now);
  const dynasty = createNewLacrosseDynasty({ seed, userTeamId: resolvedUserTeamId, seasonYear, ...(resolvedCustomTeams ? { customTeams: resolvedCustomTeams } : {}) });
  // Every rival program starts with a head coach on its sideline.
  const teams = ensureHeadCoaches(dynasty.season.teams, dynasty.userTeamId, dynasty.season.year, seed);
  return { ...dynasty, season: { ...dynasty.season, teams } };
}

// ── Custom teams config persistence ──────────────────────────────────────────

function safeStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const candidate = localStorage as unknown;
    if (!isStorageLike(candidate)) return null;
    return candidate;
  } catch {
    return null;
  }
}

function isStorageLike(value: unknown): value is Storage {
  if (typeof value !== 'object' || value === null) return false;
  const storage = value as Partial<Storage>;
  return (
    typeof storage.getItem === 'function' &&
    typeof storage.setItem === 'function' &&
    typeof storage.removeItem === 'function'
  );
}

export function saveCustomTeamsConfig(config: CustomTeamsFile): void {
  safeStorage()?.setItem(CUSTOM_TEAMS_KEY, JSON.stringify(config));
}

export function loadCustomTeamsConfig(): CustomTeamsFile | null {
  const raw = safeStorage()?.getItem(CUSTOM_TEAMS_KEY);
  if (!raw) return null;
  try {
    const result = validateCustomTeamsFile(JSON.parse(raw));
    return result.ok ? result.value : null;
  } catch {
    return null;
  }
}

export function clearCustomTeamsConfig(): void {
  safeStorage()?.removeItem(CUSTOM_TEAMS_KEY);
}

export function exportDefaultTeamsConfigJson(): string {
  // Temporarily build the default dynasty to get the live team/conf/region data.
  const dynasty = createNewLacrosseDynasty({
    seed: 1,
    userTeamId: DEFAULT_USER_TEAM_ID,
    seasonYear: DEFAULT_SEASON_YEAR,
  });

  const file: CustomTeamsFile = {
    version: 1,
    teams: dynasty.season.teams.map((t) => ({
      id: t.id,
      name: typeof t.name === 'string' ? t.name : `${t.name}`,
      conferenceId: t.conferenceId ?? '',
      regionId: t.regionId ?? '',
      nationalPrestige: t.reputation.nationalPrestige,
      academicPrestige: t.reputation.academicPrestige,
      coachingPrestige: t.reputation.coachingPrestige,
      facilities: t.reputation.facilities,
      fanSupport: t.reputation.fanSupport,
      recentSuccess: t.reputation.recentSuccess,
    })),
    conferences: dynasty.season.conferences.map((c) => ({
      id: c.id,
      name: c.name,
      shortName: c.shortName,
      prestige: c.prestige,
    })),
    regions: dynasty.season.regions.map((r) => ({
      id: r.id,
      name: r.name,
      recruitingHotbedScore: r.recruitingHotbedScore,
    })),
  };

  return JSON.stringify(file, null, 2);
}

export function parseAndValidateCustomTeamsJson(
  json: string,
): { ok: true; value: CustomTeamsFile } | { ok: false; message: string } {
  try {
    const parsed = JSON.parse(json) as unknown;
    const result = validateCustomTeamsFile(parsed);
    if (!result.ok) {
      return { ok: false, message: formatValidationErrors(result.errors) };
    }
    return { ok: true, value: result.value };
  } catch {
    return { ok: false, message: 'Invalid JSON file.' };
  }
}

function formatValidationErrors(errors: CustomTeamsValidationError[]): string {
  return errors
    .map((e) => {
      switch (e.type) {
        case 'bad_version': return 'File version must be 1.';
        case 'missing_teams': return 'File must contain at least one team.';
        case 'missing_conferences': return 'File must contain at least one conference.';
        case 'duplicate_team_id': return `Duplicate team ID: "${e.id}".`;
        case 'unknown_conference': return `Team "${e.teamId}" references unknown conference "${e.conferenceId}".`;
        case 'conference_too_small': return `Conference "${e.conferenceId}" has only ${e.count} team(s); minimum 4 required.`;
        case 'invalid_roster': return `Team "${e.teamId}" roster: ${e.reason}.`;
      }
    })
    .join(' ');
}

function nextDynastySeed(now: () => number): number {
  const candidate = Math.max(1, Math.floor(now()));
  lastIssuedSeed = Math.max(candidate, lastIssuedSeed + 1);
  return lastIssuedSeed;
}
