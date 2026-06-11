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
import {
  buildRosterFromCustomPlayers,
  generateLacrosseRoster,
  rosterScholarshipsUsed,
  type CustomPlayerDefinition,
} from './roster-generation';
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
  customTeams?: CustomTeamsFile;
}

// ── Custom teams config (import/export schema) ────────────────────────────────

export interface CustomTeamDefinition {
  id: string;
  name: string;
  conferenceId: string;
  regionId: string;
  nationalPrestige: number;
  academicPrestige: number;
  coachingPrestige: number;
  facilities: number;
  fanSupport: number;
  recentSuccess: number;
  /** Optional custom roster; omitted teams get a prestige-driven generated roster. */
  roster?: CustomPlayerDefinition[];
}

export interface CustomConferenceDefinition {
  id: string;
  name: string;
  shortName: string;
  prestige: number;
}

export interface CustomRegionDefinition {
  id: string;
  name: string;
  recruitingHotbedScore: number;
}

export interface CustomTeamsFile {
  version: 1;
  teams: CustomTeamDefinition[];
  conferences: CustomConferenceDefinition[];
  regions?: CustomRegionDefinition[];
}

export type CustomTeamsValidationError =
  | { type: 'bad_version' }
  | { type: 'missing_teams' }
  | { type: 'missing_conferences' }
  | { type: 'duplicate_team_id'; id: string }
  | { type: 'unknown_conference'; teamId: string; conferenceId: string }
  | { type: 'conference_too_small'; conferenceId: string; count: number }
  | { type: 'invalid_roster'; teamId: string; reason: string };

export function validateCustomTeamsFile(
  raw: unknown,
): { ok: true; value: CustomTeamsFile } | { ok: false; errors: CustomTeamsValidationError[] } {
  const errors: CustomTeamsValidationError[] = [];
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, errors: [{ type: 'bad_version' }] };
  }
  const obj = raw as Record<string, unknown>;
  if (obj['version'] !== 1) errors.push({ type: 'bad_version' });
  if (!Array.isArray(obj['teams']) || obj['teams'].length === 0) errors.push({ type: 'missing_teams' });
  if (!Array.isArray(obj['conferences']) || obj['conferences'].length === 0) errors.push({ type: 'missing_conferences' });
  if (errors.length > 0) return { ok: false, errors };

  const teams = obj['teams'] as CustomTeamDefinition[];
  const conferences = obj['conferences'] as CustomConferenceDefinition[];
  const confIds = new Set(conferences.map((c) => c.id));
  const seenIds = new Set<string>();

  for (const t of teams) {
    if (seenIds.has(t.id)) errors.push({ type: 'duplicate_team_id', id: t.id });
    seenIds.add(t.id);
    if (!confIds.has(t.conferenceId)) errors.push({ type: 'unknown_conference', teamId: t.id, conferenceId: t.conferenceId });
    if (t.roster !== undefined) {
      const reason = validateCustomRoster(t.roster);
      if (reason !== null) errors.push({ type: 'invalid_roster', teamId: t.id, reason });
    }
  }

  for (const conf of conferences) {
    const count = teams.filter((t) => t.conferenceId === conf.id).length;
    if (count < 4) errors.push({ type: 'conference_too_small', conferenceId: conf.id, count });
  }

  if (errors.length > 0) return { ok: false, errors };

  const result: CustomTeamsFile = { version: 1, teams, conferences };
  if (Array.isArray(obj['regions'])) result.regions = obj['regions'] as CustomRegionDefinition[];
  return { ok: true, value: result };
}

const VALID_POSITIONS = new Set(['ATT', 'MID', 'DEF', 'GK', 'FOGO', 'LSM']);
const VALID_CLASS_YEARS = new Set(['FR', 'SO', 'JR', 'SR']);

function validateCustomRoster(roster: unknown): string | null {
  if (!Array.isArray(roster)) return 'roster must be an array of players';
  if (roster.length < 12) return `roster has ${roster.length} players; minimum 12 required`;
  if (roster.length > 45) return `roster has ${roster.length} players; maximum 45 allowed`;

  for (const [i, p] of roster.entries()) {
    if (typeof p !== 'object' || p === null) return `player ${i + 1} is not an object`;
    const player = p as Record<string, unknown>;
    if (typeof player['firstName'] !== 'string' || typeof player['lastName'] !== 'string') {
      return `player ${i + 1} needs firstName and lastName`;
    }
    if (!VALID_POSITIONS.has(player['position'] as string)) {
      return `player ${i + 1} has invalid position "${String(player['position'])}"`;
    }
    if (!VALID_CLASS_YEARS.has(player['classYear'] as string)) {
      return `player ${i + 1} has invalid classYear "${String(player['classYear'])}" (use FR/SO/JR/SR)`;
    }
    const overall = player['overall'];
    if (typeof overall !== 'number' || overall < 1 || overall > 99) {
      return `player ${i + 1} needs an overall rating between 1 and 99`;
    }
    const potential = player['potential'];
    if (potential !== undefined && (typeof potential !== 'number' || potential < overall || potential > 99)) {
      return `player ${i + 1} potential must be a number between overall and 99`;
    }
  }

  const positions = roster.map((p) => (p as Record<string, unknown>)['position']);
  if (!positions.includes('GK')) return 'roster needs at least one GK';
  if (!positions.includes('FOGO')) return 'roster needs at least one FOGO';
  return null;
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

function makeTeamWithOverride(id: string, seed: number, seasonYear: number): LacrosseTeam {
  const override = TEAM_OVERRIDES[id];
  const prestige = override?.nationalPrestige ?? 60;
  const roster = generateLacrosseRoster({
    seed: seed + hashTeamId(id),
    prestige,
    createdSeason: seasonYear,
  });
  const base = makeLacrosseTeam(id, roster);
  base.resources = { ...base.resources, scholarshipUsed: rosterScholarshipsUsed(roster) };
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

function hashTeamId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function createLacrosseSeasonSchedule(
  seasonYear: number,
  conferences: Array<{ id: string; teamIds: string[] }>,
): ScheduledGame[] {
  const confSchedules = conferences.flatMap((conf) =>
    createRoundRobinSchedule(conf.teamIds, seasonYear, { conferenceGame: true, startWeek: 1 }),
  );
  const crossConf = createAutoCrossConferenceSchedule(seasonYear, conferences);
  return [...confSchedules, ...crossConf];
}

export function createNewLacrosseDynasty({
  seed,
  userTeamId,
  seasonYear,
  customTeams,
}: CreateNewLacrosseDynastyOptions): LacrosseDynastyState {
  const teams = customTeams ? buildTeamsFromConfig(customTeams, seed, seasonYear) : createInitialTeams(seed, seasonYear);
  const userTeam = teams.find((team) => team.id === userTeamId);

  if (userTeam === undefined) {
    throw new Error(`Unknown lacrosse dynasty userTeamId: ${userTeamId}`);
  }

  const recruits = generateLacrosseRecruitingClass({ count: 80, seed });
  const recruitBoard = sortRecruitBoardForTeam(userTeam, openRecruits(recruits), DEFAULT_LACROSSE_ROSTER_TARGETS);

  const conferences = customTeams ? buildConferencesFromConfig(customTeams, teams) : createDefaultConferences();
  const regions = customTeams ? buildRegionsFromConfig(customTeams) : createRegions();
  const schedule = createLacrosseSeasonSchedule(seasonYear, conferences);

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

function createInitialTeams(seed: number, seasonYear: number): LacrosseTeam[] {
  return Object.keys(TEAM_OVERRIDES).map((id) => makeTeamWithOverride(id, seed, seasonYear));
}

// Auto-generates cross-conference games: each conference plays one game against
// the "next" conference (circular), matched by team index within each conference.
function createAutoCrossConferenceSchedule(
  seasonYear: number,
  conferences: Array<{ id: string; teamIds: string[] }>,
  startWeek = 7,
): ScheduledGame[] {
  const games: ScheduledGame[] = [];
  let weekNum = startWeek;
  const n = conferences.length;

  for (let i = 0; i < n; i++) {
    const confA = conferences[i]!;
    const confB = conferences[(i + 1) % n]!;
    for (let k = 0; k < confA.teamIds.length; k++) {
      const homeId = confA.teamIds[k];
      const awayId = confB.teamIds[k % confB.teamIds.length];
      if (homeId && awayId) {
        games.push({
          id: `${seasonYear}-week-${weekNum}-${homeId}-vs-${awayId}`,
          seasonYear,
          week: weekNum,
          homeTeamId: homeId,
          awayTeamId: awayId,
          conferenceGame: false,
          status: 'scheduled',
        });
        weekNum++;
      }
    }
  }

  return games;
}

function createDefaultConferences(): Conference[] {
  const accIds = ['maryland-state', 'virginia-lakes', 'long-island-tech', 'georgetown-prep'];
  const necIds = ['new-england-college', 'colorado-front-range', 'syracuse-heights', 'penn-state-valley'];
  const b10Ids = ['ohio-summit', 'michigan-bay', 'penn-grove', 'illinois-central'];
  const pacIds = ['california-coast', 'denver-ridge', 'utah-canyon', 'oregon-cascade'];
  return [
    { id: 'acc', name: 'Atlantic Coast Conference', shortName: 'ACC', teamIds: accIds, prestige: 80, regionIds: ['mid-atlantic', 'long-island'] },
    { id: 'nec', name: 'Northeast Conference', shortName: 'NEC', teamIds: necIds, prestige: 70, regionIds: ['new-england', 'colorado', 'upstate-ny', 'mid-atlantic'] },
    { id: 'b10', name: 'Midwest Lacrosse Conference', shortName: 'MLC', teamIds: b10Ids, prestige: 62, regionIds: ['ohio-valley', 'great-lakes', 'midwest', 'mid-atlantic'] },
    { id: 'pac', name: 'Western Lacrosse Conference', shortName: 'WLC', teamIds: pacIds, prestige: 55, regionIds: ['california', 'rocky-mountain', 'pacific-northwest'] },
  ];
}

function buildConferencesFromConfig(config: CustomTeamsFile, teams: LacrosseTeam[]): Conference[] {
  return config.conferences.map((conf) => ({
    id: conf.id,
    name: conf.name,
    shortName: conf.shortName,
    teamIds: teams.filter((t) => t.conferenceId === conf.id).map((t) => t.id),
    prestige: conf.prestige,
    regionIds: [...new Set(teams.filter((t) => t.conferenceId === conf.id).map((t) => t.regionId))],
  }));
}

function buildRegionsFromConfig(config: CustomTeamsFile): Region[] {
  const defaults = createRegions();
  const customIds = new Set((config.regions ?? []).map((r) => r.id));
  const merged = defaults.filter((r) => !customIds.has(r.id));
  for (const r of config.regions ?? []) {
    merged.push({ id: r.id, name: r.name, country: 'USA', recruitingHotbedScore: r.recruitingHotbedScore });
  }
  return merged;
}

function buildTeamsFromConfig(config: CustomTeamsFile, seed: number, seasonYear: number): LacrosseTeam[] {
  return config.teams.map((def) => {
    const teamSeed = seed + hashTeamId(def.id);
    const roster = def.roster
      ? buildRosterFromCustomPlayers(def.roster, { seed: teamSeed, createdSeason: seasonYear })
      : generateLacrosseRoster({ seed: teamSeed, prestige: def.nationalPrestige, createdSeason: seasonYear });
    const base = makeLacrosseTeam(def.id, roster);
    base.resources = { ...base.resources, scholarshipUsed: rosterScholarshipsUsed(roster) };
    return {
      ...base,
      name: def.name,
      shortName: def.name,
      schoolName: def.name,
      regionId: def.regionId,
      conferenceId: def.conferenceId,
      reputation: {
        nationalPrestige: def.nationalPrestige,
        academicPrestige: def.academicPrestige,
        coachingPrestige: def.coachingPrestige,
        facilities: def.facilities,
        fanSupport: def.fanSupport,
        recentSuccess: def.recentSuccess,
      },
    };
  });
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
