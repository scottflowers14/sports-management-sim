import type { Recruit } from '@sports-management-sim/engine-core';
import type { LacrossePlayerTraits, LacrossePosition } from './models';

export type LacrosseRecruit = Recruit<LacrossePosition, LacrossePlayerTraits>;

export interface GenerateLacrosseRecruitingClassOptions {
  count: number;
  seed?: number;
}

const REGIONS = [
  { id: 'mid-atlantic', hometowns: ['Baltimore, MD', 'Annapolis, MD', 'Richmond, VA'], weight: 24 },
  { id: 'long-island', hometowns: ['Garden City, NY', 'Massapequa, NY', 'Manhasset, NY'], weight: 18 },
  { id: 'upstate-ny', hometowns: ['Syracuse, NY', 'Rochester, NY', 'Albany, NY'], weight: 14 },
  { id: 'new-england', hometowns: ['Boston, MA', 'Greenwich, CT', 'Providence, RI'], weight: 12 },
  { id: 'colorado', hometowns: ['Denver, CO', 'Boulder, CO', 'Colorado Springs, CO'], weight: 8 },
  { id: 'southeast', hometowns: ['Charlotte, NC', 'Atlanta, GA', 'Nashville, TN'], weight: 6 },
  { id: 'midwest', hometowns: ['Columbus, OH', 'Chicago, IL', 'Detroit, MI'], weight: 6 },
  { id: 'west', hometowns: ['Los Angeles, CA', 'San Diego, CA', 'Seattle, WA'], weight: 4 },
] as const;

const POSITION_WEIGHTS: Array<{ position: LacrossePosition; weight: number }> = [
  { position: 'MID', weight: 30 },
  { position: 'ATT', weight: 20 },
  { position: 'DEF', weight: 22 },
  { position: 'GK', weight: 8 },
  { position: 'FOGO', weight: 8 },
  { position: 'LSM', weight: 12 },
];

const FIRST_NAMES = ['Casey', 'Ryan', 'Dylan', 'Jack', 'Connor', 'Avery', 'Logan', 'Tyler'];
const LAST_NAMES = ['Smith', 'Kelly', 'Murphy', 'Brown', 'Miller', 'Davis', 'Owen', 'Brennan'];

export function generateLacrosseRecruitingClass({
  count,
  seed = 1,
}: GenerateLacrosseRecruitingClassOptions): LacrosseRecruit[] {
  const random = createSeededRandom(seed);

  return Array.from({ length: count }, (_, index) => {
    const region = pickWeighted(REGIONS, random);
    const position = pickWeighted(POSITION_WEIGHTS, random).position;
    const starRating = generateStarRating(random);
    const overall = clamp(Math.round(36 + starRating * 7 + random() * 12), 35, 85);
    const potential = clamp(Math.round(overall + 8 + random() * 18), overall, 99);

    return {
      id: `lacrosse-recruit-${seed}-${index + 1}`,
      name: {
        first: pick(FIRST_NAMES, random),
        last: pick(LAST_NAMES, random),
      },
      age: random() > 0.9 ? 18 : 17,
      hometown: pick([...region.hometowns], random),
      regionId: region.id,
      position,
      starRating,
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
        leadership: ratingAround(overall - 5, random),
      },
      sportTraits: createSportTraits(position, overall, random),
      preferences: {
        proximityImportance: randomRating(random),
        prestigeImportance: randomRating(random),
        scholarshipImportance: randomRating(random),
        playingTimeImportance: randomRating(random),
        academicImportance: randomRating(random),
      },
      interestByTeamId: {},
      scholarshipOffers: [],
      status: 'open',
    };
  });
}

export function createSportTraits(position: LacrossePosition, base: number, random: () => number): LacrossePlayerTraits {
  return {
    shooting: ratingAround(position === 'ATT' ? base + 8 : base, random),
    passing: ratingAround(position === 'MID' ? base + 5 : base, random),
    dodging: ratingAround(position === 'MID' || position === 'ATT' ? base + 6 : base - 4, random),
    stickSkills: ratingAround(base, random),
    offBallMovement: ratingAround(base, random),
    defense: ratingAround(position === 'DEF' || position === 'LSM' ? base + 8 : base - 2, random),
    checking: ratingAround(position === 'DEF' || position === 'LSM' ? base + 8 : base - 3, random),
    groundBalls: ratingAround(position === 'FOGO' || position === 'LSM' ? base + 8 : base, random),
    ...(position === 'FOGO' ? { faceoffs: ratingAround(base + 15, random) } : {}),
    ...(position === 'GK'
      ? {
          goalieReflexes: ratingAround(base + 12, random),
          goaliePositioning: ratingAround(base + 10, random),
          goalieClearing: ratingAround(base, random),
        }
      : {}),
    preferredHand: random() > 0.22 ? 'right' : 'left',
  };
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pickWeighted<T extends { weight: number }>(items: readonly T[], random: () => number): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let target = random() * totalWeight;

  for (const item of items) {
    target -= item.weight;
    if (target <= 0) {
      return item;
    }
  }

  return items[items.length - 1] as T;
}

function pick<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] as T;
}

function generateStarRating(random: () => number): 1 | 2 | 3 | 4 | 5 {
  const roll = random();
  if (roll > 0.97) return 5;
  if (roll > 0.84) return 4;
  if (roll > 0.55) return 3;
  if (roll > 0.22) return 2;
  return 1;
}

function randomRating(random: () => number): number {
  return Math.round(35 + random() * 60);
}

function ratingAround(base: number, random: () => number): number {
  return clamp(Math.round(base - 10 + random() * 20), 1, 99);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
