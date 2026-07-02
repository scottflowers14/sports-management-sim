import type { PlayerClass } from '@sports-management-sim/engine-core';
import type { LacrossePlayer, LacrossePosition } from './models';
import { LACROSSE_FIRST_NAMES as FIRST_NAMES, LACROSSE_LAST_NAMES as LAST_NAMES } from './names';
import { createSportTraits } from './recruit-generation';

export interface GenerateLacrosseRosterOptions {
  /** Seed for deterministic generation; vary per team. */
  seed: number;
  /** National prestige (0–99) drives the roster's talent level. */
  prestige: number;
  createdSeason: number;
}

/** 42 players: full position groups with headroom under the 45-man cap for recruits/transfers. */
const ROSTER_COMPOSITION: Array<[LacrossePosition, number]> = [
  ['ATT', 8],
  ['MID', 14],
  ['DEF', 9],
  ['LSM', 4],
  ['GK', 4],
  ['FOGO', 3],
];

const CLASS_ORDER: PlayerClass[] = ['FR', 'SO', 'JR', 'SR'];

/**
 * Generate a full, realistic starting roster: position groups sized to need,
 * an even class-year spread, talent centered on program prestige with real
 * variance, and 12.6 scholarships distributed best-player-first.
 */
export function generateLacrosseRoster({ seed, prestige, createdSeason }: GenerateLacrosseRosterOptions): LacrossePlayer[] {
  const random = createSeededRandom(seed);
  const players: LacrossePlayer[] = [];
  let index = 0;

  for (const [position, count] of ROSTER_COMPOSITION) {
    for (let i = 0; i < count; i += 1) {
      const classYear = CLASS_ORDER[(i + Math.floor(random() * 2)) % CLASS_ORDER.length]!;
      players.push(generatePlayer({ seed, index, position, classYear, prestige, createdSeason, random }));
      index += 1;
    }
  }

  return assignScholarships(players);
}

/**
 * Late-summer walk-on tryouts: unrated freshmen who backfill thin rosters so a
 * program that whiffed on a recruiting class can still field a team. No
 * scholarship money, modest talent regardless of program prestige.
 */
export function generateLacrosseWalkOns({
  seed,
  createdSeason,
  positions,
}: {
  seed: number;
  createdSeason: number;
  positions: LacrossePosition[];
}): LacrossePlayer[] {
  const random = createSeededRandom(seed);
  return positions.map((position, index) => {
    const player = generatePlayer({
      seed,
      index,
      position,
      classYear: 'FR',
      prestige: 24,
      createdSeason,
      random,
    });
    return { ...player, id: `walkon-${createdSeason}-${seed}-${index}` };
  });
}

export function rosterScholarshipsUsed(roster: LacrossePlayer[]): number {
  return Math.round(roster.reduce((sum, p) => sum + p.scholarshipPercent / 100, 0) * 100) / 100;
}

/** A player entry in an imported custom-teams file. */
export interface CustomPlayerDefinition {
  firstName: string;
  lastName: string;
  position: LacrossePosition;
  classYear: 'FR' | 'SO' | 'JR' | 'SR';
  /** 1–99 */
  overall: number;
  /** Defaults to overall plus development headroom by class. */
  potential?: number;
}

/** Build full players from imported definitions: attributes and traits are derived from overall. */
export function buildRosterFromCustomPlayers(
  defs: CustomPlayerDefinition[],
  { seed, createdSeason }: { seed: number; createdSeason: number },
): LacrossePlayer[] {
  const random = createSeededRandom(seed);

  const players = defs.map((def, index): LacrossePlayer => {
    const overall = clamp(Math.round(def.overall), 1, 99);
    const classIndex = CLASS_ORDER.indexOf(def.classYear);
    const seasonsLeft = { FR: 4, SO: 3, JR: 2, SR: 1 }[def.classYear];
    const potential = clamp(Math.round(def.potential ?? overall + seasonsLeft * 3), overall, 99);

    return {
      id: `custom-${seed}-${index}`,
      name: { first: def.firstName, last: def.lastName },
      age: 18 + Math.max(0, classIndex),
      classYear: def.classYear,
      hometown: 'Baltimore, MD',
      regionId: 'mid-atlantic',
      position: def.position,
      secondaryPositions: [],
      ratings: {
        overall,
        potential,
        athleticism: ratingAround(overall, random),
        speed: ratingAround(overall, random),
        strength: ratingAround(overall, random),
        stamina: ratingAround(overall, random),
        skill: ratingAround(overall, random),
        iq: ratingAround(overall, random),
        discipline: ratingAround(overall, random),
        workEthic: ratingAround(overall + 5, random),
        leadership: ratingAround(overall - 5 + classIndex * 4, random),
      },
      traits: [],
      sportTraits: createSportTraits(def.position, overall, random),
      scholarshipPercent: 0,
      isWalkOn: true,
      morale: 60 + Math.round(random() * 30),
      health: 100,
      fatigue: 0,
      redshirtStatus: 'none',
      eligibility: {
        seasonsPlayed: classIndex,
        seasonsRemaining: seasonsLeft,
        isEligible: true,
      },
      createdSeason,
    };
  });

  return assignScholarships(players);
}

function generatePlayer({
  seed,
  index,
  position,
  classYear,
  prestige,
  createdSeason,
  random,
}: {
  seed: number;
  index: number;
  position: LacrossePosition;
  classYear: PlayerClass;
  prestige: number;
  createdSeason: number;
  random: () => number;
}): LacrossePlayer {
  // Prestige 85 program averages ~mid-60s overall; prestige 50 averages ~low 50s
  const talentBase = 34 + prestige * 0.34;
  const classBonus = { FR: -4, SO: 0, JR: 3, SR: 5, GR: 5 }[classYear];
  const overall = clamp(Math.round(talentBase + classBonus + (random() * 24 - 12)), 35, 92);
  const seasonsLeft = { FR: 4, SO: 3, JR: 2, SR: 1, GR: 1 }[classYear];
  const potential = clamp(Math.round(overall + seasonsLeft * (2 + random() * 5)), overall, 99);
  const classIndex = CLASS_ORDER.indexOf(classYear);

  return {
    id: `gen-${seed}-${index}`,
    name: { first: pick(FIRST_NAMES, random), last: pick(LAST_NAMES, random) },
    age: 18 + Math.max(0, classIndex),
    classYear,
    hometown: 'Baltimore, MD',
    regionId: 'mid-atlantic',
    position,
    secondaryPositions: [],
    ratings: {
      overall,
      potential,
      athleticism: ratingAround(overall, random),
      speed: ratingAround(overall, random),
      strength: ratingAround(overall, random),
      stamina: ratingAround(overall, random),
      skill: ratingAround(overall, random),
      iq: ratingAround(overall, random),
      discipline: ratingAround(overall, random),
      workEthic: ratingAround(overall + 5, random),
      leadership: ratingAround(overall - 5 + classIndex * 4, random),
    },
    traits: [],
    sportTraits: createSportTraits(position, overall, random),
    scholarshipPercent: 0,
    isWalkOn: true,
    morale: 60 + Math.round(random() * 30),
    health: 100,
    fatigue: 0,
    redshirtStatus: 'none',
    eligibility: {
      seasonsPlayed: classIndex,
      seasonsRemaining: seasonsLeft,
      isEligible: true,
    },
    createdSeason,
  };
}

/** Top players carry the 12.6-equivalent budget: 10 × 60% + 12 × 30% + 10 × 25% = 12.1 used. */
function assignScholarships(players: LacrossePlayer[]): LacrossePlayer[] {
  const byOverall = [...players].sort((a, b) => b.ratings.overall - a.ratings.overall);
  const tierFor = new Map<string, number>();
  byOverall.forEach((player, rank) => {
    tierFor.set(player.id, rank < 10 ? 60 : rank < 22 ? 30 : rank < 32 ? 25 : 0);
  });

  return players.map((player) => {
    const scholarshipPercent = tierFor.get(player.id) ?? 0;
    return { ...player, scholarshipPercent, isWalkOn: scholarshipPercent === 0 };
  });
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pick<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] as T;
}

function ratingAround(base: number, random: () => number): number {
  return clamp(Math.round(base - 10 + random() * 20), 1, 99);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
