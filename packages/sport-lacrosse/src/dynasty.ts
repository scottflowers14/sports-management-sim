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

function ov(
  name: string,
  regionId: string,
  conferenceId: string,
  nationalPrestige: number,
  academicPrestige: number,
  coachingPrestige: number,
  facilities: number,
  fanSupport: number,
  recentSuccess: number,
): TeamOverride {
  return { name, regionId, conferenceId, nationalPrestige, academicPrestige, coachingPrestige, facilities, fanSupport, recentSuccess };
}

const TEAM_OVERRIDES: Record<string, TeamOverride> = {
  // ── Atlantic Coast Conference ──
  'maryland-state': ov('Maryland State', 'mid-atlantic', 'acc', 85, 72, 82, 88, 80, 78),
  'virginia-lakes': ov('Virginia Lakes', 'mid-atlantic', 'acc', 75, 78, 74, 76, 70, 68),
  'syracuse-heights': ov('Syracuse Heights', 'upstate-ny', 'acc', 78, 70, 76, 80, 74, 72),
  'carolina-pines': ov('Carolina Pines', 'southeast', 'acc', 77, 74, 76, 80, 76, 72),
  'blue-ridge': ov('Blue Ridge', 'southeast', 'acc', 70, 68, 68, 72, 66, 64),
  'capital-city': ov('Capital City', 'mid-atlantic', 'acc', 66, 70, 64, 68, 62, 60),
  // ── Big Ten ──
  'harbor-city': ov('Harbor City', 'mid-atlantic', 'b10', 82, 80, 80, 84, 78, 76),
  'penn-state-valley': ov('Penn State Valley', 'mid-atlantic', 'b10', 70, 75, 68, 72, 68, 63),
  'michigan-bay': ov('Michigan Bay', 'great-lakes', 'b10', 68, 74, 66, 70, 65, 62),
  'ohio-summit': ov('Ohio Summit', 'ohio-valley', 'b10', 65, 72, 63, 67, 62, 58),
  'garden-state': ov('Garden State', 'mid-atlantic', 'b10', 60, 66, 58, 62, 58, 54),
  'illinois-central': ov('Illinois Central', 'midwest', 'b10', 58, 70, 56, 60, 55, 50),
  // ── Ivy League ──
  'cayuga-falls': ov('Cayuga Falls', 'upstate-ny', 'ivy', 78, 92, 76, 74, 70, 74),
  'liberty-hall': ov('Liberty Hall', 'mid-atlantic', 'ivy', 76, 95, 74, 72, 68, 72),
  'quaker-green': ov('Quaker Green', 'mid-atlantic', 'ivy', 69, 93, 66, 66, 62, 64),
  'cambridge-college': ov('Cambridge College', 'new-england', 'ivy', 66, 95, 64, 64, 60, 60),
  'college-hill': ov('College Hill', 'new-england', 'ivy', 60, 92, 58, 58, 54, 56),
  'north-woods': ov('North Woods', 'new-england', 'ivy', 56, 90, 54, 56, 52, 50),
  // ── Big East ──
  'long-island-tech': ov('Long Island Tech', 'long-island', 'bigeast', 80, 68, 78, 82, 75, 74),
  'denver-ridge': ov('Denver Ridge', 'rocky-mountain', 'bigeast', 74, 65, 72, 76, 68, 70),
  'georgetown-prep': ov('Georgetown Prep', 'mid-atlantic', 'bigeast', 68, 88, 66, 70, 65, 60),
  'penn-grove': ov('Penn Grove', 'mid-atlantic', 'bigeast', 62, 76, 60, 64, 58, 55),
  'lakefront-catholic': ov('Lakefront Catholic', 'midwest', 'bigeast', 58, 70, 56, 60, 56, 52),
  'ocean-state': ov('Ocean State', 'new-england', 'bigeast', 54, 66, 52, 56, 52, 48),
  // ── Patriot League ──
  'annapolis-naval': ov('Annapolis Naval', 'mid-atlantic', 'patriot', 72, 78, 70, 74, 74, 68),
  'new-england-college': ov('New England College', 'new-england', 'patriot', 72, 82, 70, 74, 68, 65),
  'hudson-military': ov('Hudson Military', 'upstate-ny', 'patriot', 69, 78, 68, 72, 72, 66),
  'chenango-valley': ov('Chenango Valley', 'upstate-ny', 'patriot', 61, 74, 60, 60, 56, 58),
  'seven-hills': ov('Seven Hills', 'new-england', 'patriot', 58, 76, 56, 58, 54, 54),
  'bucks-county': ov('Bucks County', 'mid-atlantic', 'patriot', 55, 72, 52, 56, 50, 52),
  // ── ASUN ──
  'colorado-front-range': ov('Colorado Front Range', 'colorado', 'asun', 62, 65, 60, 64, 60, 55),
  'air-academy': ov('Air Academy', 'colorado', 'asun', 57, 74, 56, 60, 58, 54),
  'california-coast': ov('California Coast', 'california', 'asun', 55, 68, 54, 58, 52, 48),
  'utah-canyon': ov('Utah Canyon', 'rocky-mountain', 'asun', 52, 62, 50, 54, 48, 44),
  'oregon-cascade': ov('Oregon Cascade', 'pacific-northwest', 'asun', 50, 64, 48, 52, 46, 42),
  'motor-city': ov('Motor City', 'great-lakes', 'asun', 47, 60, 46, 48, 46, 44),
};

const CONFERENCE_META = [
  { id: 'acc', name: 'Atlantic Coast Conference', shortName: 'ACC', prestige: 85 },
  { id: 'b10', name: 'Big Ten', shortName: 'B1G', prestige: 80 },
  { id: 'ivy', name: 'Ivy League', shortName: 'Ivy', prestige: 75 },
  { id: 'bigeast', name: 'Big East', shortName: 'BE', prestige: 72 },
  { id: 'patriot', name: 'Patriot League', shortName: 'PL', prestige: 68 },
  { id: 'asun', name: 'ASUN', shortName: 'ASUN', prestige: 55 },
] as const;

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
  // Real college lacrosse shape: non-conference slate first, then a single
  // conference round-robin (league rivals meet once; rematches happen in May).
  const nonConfWeeks = Math.max(0, Math.min(5, conferences.length - 1));
  const nonConf = createNonConferenceSchedule(seasonYear, conferences, nonConfWeeks);
  const confSchedules = conferences.flatMap((conf) =>
    createRoundRobinSchedule(conf.teamIds, seasonYear, { conferenceGame: true, startWeek: nonConfWeeks + 1 }),
  );
  return [...nonConf, ...confSchedules];
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

  const recruits = generateLacrosseRecruitingClass({ count: recruitingClassSize(teams.length), seed });
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
  const updated = applyCpuWeeklyOffers(recruits, allTeams, userTeamId);

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

  const updated = [...recruits];

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

function openRecruits(recruits: LacrosseRecruit[]): LacrosseRecruit[] {
  return recruits.filter((recruit) => recruit.status === 'open');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function recruitingClassSize(teamCount: number): number {
  return Math.max(80, teamCount * 5);
}

function createInitialTeams(seed: number, seasonYear: number): LacrosseTeam[] {
  return Object.keys(TEAM_OVERRIDES).map((id) => makeTeamWithOverride(id, seed, seasonYear));
}

// Non-conference play: one week per round, every conference paired with one
// other conference per week (circle method), teams matched by rotating index.
function createNonConferenceSchedule(
  seasonYear: number,
  conferences: Array<{ id: string; teamIds: string[] }>,
  rounds: number,
): ScheduledGame[] {
  const games: ScheduledGame[] = [];
  if (conferences.length < 2 || rounds < 1) return games;

  const slots: Array<number | null> =
    conferences.length % 2 === 0
      ? conferences.map((_, i) => i)
      : [...conferences.map((_, i) => i), null];
  const n = slots.length;

  for (let round = 0; round < Math.min(rounds, n - 1); round += 1) {
    const week = round + 1;
    for (let k = 0; k < n / 2; k += 1) {
      const ai = slots[k];
      const bi = slots[n - 1 - k];
      if (ai == null || bi == null) continue;
      const confA = conferences[ai]!;
      const confB = conferences[bi]!;
      const matchups = Math.min(confA.teamIds.length, confB.teamIds.length);

      for (let m = 0; m < matchups; m += 1) {
        const a = confA.teamIds[m];
        const b = confB.teamIds[(m + round) % confB.teamIds.length];
        if (!a || !b) continue;
        const [homeTeamId, awayTeamId] = (m + round) % 2 === 0 ? [a, b] : [b, a];
        games.push({
          id: `${seasonYear}-week-${week}-${homeTeamId}-vs-${awayTeamId}`,
          seasonYear,
          week,
          homeTeamId,
          awayTeamId,
          conferenceGame: false,
          status: 'scheduled',
        });
      }
    }
    slots.splice(1, 0, slots.pop()!);
  }

  return games;
}

function createDefaultConferences(): Conference[] {
  return CONFERENCE_META.map((meta) => {
    const members = Object.entries(TEAM_OVERRIDES).filter(([, o]) => o.conferenceId === meta.id);
    return {
      id: meta.id,
      name: meta.name,
      shortName: meta.shortName,
      prestige: meta.prestige,
      teamIds: members.map(([id]) => id),
      regionIds: [...new Set(members.map(([, o]) => o.regionId))],
    };
  });
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
